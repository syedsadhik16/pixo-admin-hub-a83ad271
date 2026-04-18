// Push admin export rows to a shared Google Sheet.
// Requires GOOGLE_SHEETS_SERVICE_ACCOUNT (JSON string) + GOOGLE_SHEETS_TARGET_ID secrets.
// Caller must be authenticated admin/founder.
// Body: { exportType: string, columns: {key,label}[], rows: any[] }

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlStr(s: string): string {
  return b64url(new TextEncoder().encode(s));
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function ensureSheet(spreadsheetId: string, title: string, token: string) {
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!meta.ok) throw new Error(`Sheets metadata fetch failed [${meta.status}]: ${await meta.text()}`);
  const m = await meta.json();
  const exists = (m.sheets ?? []).some((s: any) => s.properties?.title === title);
  if (exists) return;
  const add = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    },
  );
  if (!add.ok) throw new Error(`addSheet failed [${add.status}]: ${await add.text()}`);
}

async function writeValues(spreadsheetId: string, sheetTitle: string, values: any[][], token: string) {
  // Clear then write.
  const range = `${sheetTitle}!A1:ZZ`;
  const clr = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!clr.ok) throw new Error(`clear failed [${clr.status}]: ${await clr.text()}`);

  const writeRange = `${sheetTitle}!A1`;
  const upd = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!upd.ok) throw new Error(`values.update failed [${upd.status}]: ${await upd.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Authorize: admin/founder only.
    const { data: isAdmin } = await supabase.rpc("is_admin_or_founder", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const saRaw = Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT");
    const sheetId = Deno.env.get("GOOGLE_SHEETS_TARGET_ID");
    if (!saRaw || !sheetId) {
      return new Response(JSON.stringify({
        ok: false,
        status: "not_configured",
        message: "GOOGLE_SHEETS_SERVICE_ACCOUNT or GOOGLE_SHEETS_TARGET_ID not set.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(saRaw);
    } catch {
      return new Response(JSON.stringify({ error: "GOOGLE_SHEETS_SERVICE_ACCOUNT must be valid JSON" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sa.client_email || !sa.private_key) {
      return new Response(JSON.stringify({ error: "service account missing client_email/private_key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { exportType, columns, rows } = body as {
      exportType?: string;
      columns?: { key: string; label: string }[];
      rows?: Record<string, unknown>[];
    };
    if (!exportType || !Array.isArray(columns) || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "exportType, columns[], rows[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken(sa);
    const sheetTitle = exportType.slice(0, 90); // Sheets title limit
    await ensureSheet(sheetId, sheetTitle, token);

    const header = columns.map(c => c.label);
    const dataRows = rows.map(r => columns.map(c => {
      const v = (r as any)[c.key];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    }));
    await writeValues(sheetId, sheetTitle, [header, ...dataRows], token);

    // Audit
    await supabase.from("exports_audit").insert([{
      actor_user_id: user.id,
      export_type: exportType,
      row_count: rows.length,
      destination: "sheets",
      filters: { sheet_title: sheetTitle } as never,
    }]);

    return new Response(JSON.stringify({
      ok: true,
      sheetId,
      sheetTitle,
      rowCount: rows.length,
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("export-to-sheets error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
