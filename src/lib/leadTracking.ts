// Lead & payment-intent tracker.
// Writes to public.lead_events (RLS allows anon insert) and public.payment_funnel_events.
// Best-effort: failures are swallowed so UX flows never break on telemetry errors.

import { supabase } from "@/integrations/supabase/client";

export type LeadEventType =
  | "signup"
  | "login_attempt"
  | "login_success"
  | "login_failed"
  | "payment_page_view"
  | "payment_initiated"
  | "payment_success"
  | "payment_failed";

export interface LeadEventInput {
  event_type: LeadEventType;
  email?: string | null;
  phone?: string | null;
  user_id?: string | null;
  role_attempted?: string | null;
  success?: boolean | null;
  failure_reason?: string | null;
  route?: string | null;
  meta?: Record<string, unknown>;
}

function detectClient() {
  if (typeof navigator === "undefined") {
    return { user_agent: null, browser: null, device_type: null, app_source: "web" };
  }
  const ua = navigator.userAgent || "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  return {
    user_agent: ua,
    browser,
    device_type: isMobile ? "mobile" : "desktop",
    app_source: "web",
  };
}

export async function trackLeadEvent(input: LeadEventInput): Promise<void> {
  try {
    const client = detectClient();
    const route = input.route ?? (typeof window !== "undefined" ? window.location.pathname : null);

    await supabase.from("lead_events").insert({
      event_type: input.event_type,
      email: input.email?.toLowerCase().trim() || null,
      phone: input.phone || null,
      user_id: input.user_id || null,
      role_attempted: input.role_attempted || null,
      success: input.success ?? null,
      failure_reason: input.failure_reason || null,
      route,
      app_source: client.app_source,
      device_type: client.device_type,
      browser: client.browser,
      user_agent: client.user_agent,
      meta: (input.meta ?? {}) as never,
    });
  } catch (err) {
    // Telemetry must never break user flows
    console.warn("[trackLeadEvent] failed:", err);
  }
}

export interface PaymentFunnelInput {
  user_id: string;
  event_type: "page_view" | "initiated" | "success" | "failed";
  plan_name?: string | null;
  amount?: number | null;
  failure_reason?: string | null;
  meta?: Record<string, unknown>;
}

/** Records a row in payment_funnel_events AND mirrors to lead_events for unified tracking. */
export async function trackPaymentFunnel(input: PaymentFunnelInput): Promise<void> {
  try {
    await supabase.from("payment_funnel_events").insert({
      user_id: input.user_id,
      event_type: input.event_type,
      plan_name: input.plan_name ?? null,
      amount: input.amount ?? null,
      failure_reason: input.failure_reason ?? null,
      meta: (input.meta ?? {}) as never,
    });

    const mirrorMap: Record<PaymentFunnelInput["event_type"], LeadEventType> = {
      page_view: "payment_page_view",
      initiated: "payment_initiated",
      success: "payment_success",
      failed: "payment_failed",
    };
    await trackLeadEvent({
      event_type: mirrorMap[input.event_type],
      user_id: input.user_id,
      success: input.event_type === "success" ? true : input.event_type === "failed" ? false : null,
      failure_reason: input.failure_reason ?? null,
      meta: { plan_name: input.plan_name, amount: input.amount, ...(input.meta ?? {}) },
    });
  } catch (err) {
    console.warn("[trackPaymentFunnel] failed:", err);
  }
}
