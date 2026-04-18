// CSV export utility — converts an array of records to a downloadable CSV file.
// Used by all admin Export buttons. Logs each export to exports_audit.

import { supabase } from "@/integrations/supabase/client";

function escapeCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else if (typeof val === "object") s = JSON.stringify(val);
  else s = String(val);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T>(
  rows: T[],
  columns?: { key: keyof T; label: string }[],
): string {
  if (rows.length === 0 && !columns) return "";
  const cols = columns ?? Object.keys((rows[0] ?? {}) as object).map(k => ({ key: k as keyof T, label: k }));
  const header = cols.map(c => escapeCell(c.label)).join(",");
  const body = rows.map(r => cols.map(c => escapeCell((r as Record<string, unknown>)[c.key as string])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function logExport(opts: {
  exportType: string;
  rowCount: number;
  filters?: Record<string, unknown>;
  destination?: "csv" | "sheets" | "xlsx";
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("exports_audit").insert([{
    actor_user_id: user.id,
    export_type: opts.exportType,
    row_count: opts.rowCount,
    filters: (opts.filters ?? {}) as never,
    destination: opts.destination ?? "csv",
  }]);
}

export async function exportAndDownload<T>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string }[],
  exportType: string,
  filters?: Record<string, unknown>,
) {
  const csv = rowsToCsv(rows, columns);
  downloadCsv(filename, csv);
  await logExport({ exportType, rowCount: rows.length, filters });
}
