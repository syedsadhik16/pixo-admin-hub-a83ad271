import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface AdminDiagnosticsResult {
  email: string;
  hasAuthUser: boolean;
  hasEmployeeProfile: boolean;
  employeeRole: string | null;
  employeeStatus: string | null;
  hasAdminRole: boolean;
  canAccessAdmin: boolean;
}

export interface AdminRedirectState {
  accessDenied?: string;
  from?: string;
}

export interface AdminEmployeeRecord {
  id?: string;
  employee_code?: string;
  name?: string;
  email: string | null;
  role: string | null;
  status: string | null;
}

export interface AdminAccessResult {
  session: Session | null;
  user: User | null;
  employee: AdminEmployeeRecord | null;
  diagnostics: AdminDiagnosticsResult | null;
  isAdmin: boolean;
  error: string | null;
}

const SESSION_ERROR = "No active session";
const ACCESS_ERROR = "Access not configured";

function logDev(step: string, payload?: unknown) {
  if (!import.meta.env.DEV) return;
  if (payload === undefined) {
    console.info(`[admin-auth] ${step}`);
    return;
  }
  console.info(`[admin-auth] ${step}`, payload);
}

function parseDiagnostics(data: unknown, fallbackEmail: string): AdminDiagnosticsResult | null {
  if (!data || typeof data !== "object") return null;
  const source = data as Record<string, unknown>;

  return {
    email: typeof source.email === "string" ? source.email : fallbackEmail,
    hasAuthUser: Boolean(source.hasAuthUser),
    hasEmployeeProfile: Boolean(source.hasEmployeeProfile),
    employeeRole: typeof source.employeeRole === "string" ? source.employeeRole : null,
    employeeStatus: typeof source.employeeStatus === "string" ? source.employeeStatus : null,
    hasAdminRole: Boolean(source.hasAdminRole),
    canAccessAdmin: Boolean(source.canAccessAdmin),
  };
}

function employeeFromDiagnostics(diag: AdminDiagnosticsResult): AdminEmployeeRecord | null {
  if (!diag.hasEmployeeProfile) return null;

  return {
    email: diag.email,
    role: diag.employeeRole,
    status: diag.employeeStatus,
  };
}

function messageFromDiagnostics(diag: AdminDiagnosticsResult | null) {
  if (!diag) return ACCESS_ERROR;
  if (!diag.hasAuthUser) return "Auth account not found for this email";
  if (!diag.hasEmployeeProfile) return "Employee profile not found for this email";
  if (diag.employeeStatus !== "active") return `Employee account is ${diag.employeeStatus ?? "inactive"}`;
  if (diag.employeeRole !== "admin") return `Employee role is ${diag.employeeRole ?? "missing"}, not admin`;
  if (!diag.hasAdminRole) return "Admin role row is missing";
  return ACCESS_ERROR;
}

export async function fetchAdminDiagnostics(email: string, userId?: string | null): Promise<AdminDiagnosticsResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.functions.invoke("admin-access-check", {
    body: { email: normalizedEmail, userId: userId ?? null },
  });

  if (error) throw error;

  const diag = parseDiagnostics(data, normalizedEmail);
  if (!diag) throw new Error("Invalid diagnostics response");

  logDev("profile lookup result", diag);
  logDev("employee profile lookup result", {
    hasEmployeeProfile: diag.hasEmployeeProfile,
    employeeRole: diag.employeeRole,
    employeeStatus: diag.employeeStatus,
  });
  logDev("admin role verdict", {
    hasAdminRole: diag.hasAdminRole,
    canAccessAdmin: diag.canAccessAdmin,
  });

  return diag;
}

export async function resolveAdminAccess(sessionOverride?: Session | null): Promise<AdminAccessResult> {
  let session = sessionOverride ?? null;

  if (!session) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logDev("session received", { error: error.message });
      return {
        session: null,
        user: null,
        employee: null,
        diagnostics: null,
        isAdmin: false,
        error: error.message,
      };
    }
    session = data.session;
  }

  if (!session?.user) {
    logDev("session received", { session: false });
    return {
      session: null,
      user: null,
      employee: null,
      diagnostics: null,
      isAdmin: false,
      error: SESSION_ERROR,
    };
  }

  const normalizedEmail = session.user.email?.trim().toLowerCase() ?? "";
  logDev("session received", { hasSession: true, email: normalizedEmail });
  logDev("auth user id", session.user.id);

  if (!normalizedEmail) {
    return {
      session,
      user: session.user,
      employee: null,
      diagnostics: null,
      isAdmin: false,
      error: "No email on session",
    };
  }

  try {
    const diagnostics = await fetchAdminDiagnostics(normalizedEmail, session.user.id);
    return {
      session,
      user: session.user,
      employee: employeeFromDiagnostics(diagnostics),
      diagnostics,
      isAdmin: diagnostics.canAccessAdmin,
      error: diagnostics.canAccessAdmin ? null : messageFromDiagnostics(diagnostics),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify admin access";
    logDev("admin role verdict", { error: message });

    return {
      session,
      user: session.user,
      employee: null,
      diagnostics: null,
      isAdmin: false,
      error: message,
    };
  }
}

export async function refreshAndResolveAdminAccess(sessionOverride?: Session | null) {
  let session = sessionOverride ?? null;

  if (!session) {
    const current = await supabase.auth.getSession();
    session = current.data.session;
  }

  if (!session?.refresh_token) {
    logDev("session refresh skipped", { reason: "missing_refresh_token" });
    return resolveAdminAccess(session);
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
  if (error) {
    logDev("session refresh skipped", { error: error.message });
    return resolveAdminAccess(session);
  }

  return resolveAdminAccess(data.session ?? session);
}

export function getAdminRedirectTarget(from?: string | null) {
  if (typeof from === "string" && from.startsWith("/admin/") && from !== "/admin/login") {
    return from;
  }

  return "/admin/dashboard";
}

export function getAdminAccessMessage(result: Pick<AdminAccessResult, "error" | "diagnostics">) {
  return result.error ?? messageFromDiagnostics(result.diagnostics);
}