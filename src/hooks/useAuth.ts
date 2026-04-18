import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type EmployeeRole = "admin" | "sales" | "ops" | "founder" | "staff";

interface EmployeeRecord {
  id: string;
  employee_code: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  employee: EmployeeRecord | null;
  loading: boolean;
  accessError: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    employee: null,
    loading: true,
    accessError: null,
  });

  const fetchEmployee = useCallback(async (email: string | undefined): Promise<{ employee: EmployeeRecord | null; error: string | null }> => {
    if (!email) return { employee: null, error: "No email on session" };
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("id, employee_code, name, email, role, status")
      .ilike("email", email)
      .maybeSingle();

    if (error) return { employee: null, error: error.message };
    if (!data) return { employee: null, error: "Access not configured" };
    if (data.status !== "active") return { employee: null, error: "Account inactive" };
    return { employee: data as EmployeeRecord, error: null };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Defer DB call to avoid deadlock inside auth callback
        setTimeout(async () => {
          const { employee, error } = await fetchEmployee(session.user.email);
          setState({ user: session.user, session, employee, loading: false, accessError: error });
        }, 0);
      } else {
        setState({ user: null, session: null, employee: null, loading: false, accessError: null });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { employee, error } = await fetchEmployee(session.user.email);
        setState({ user: session.user, session, employee, loading: false, accessError: error });
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    }).catch(e => {
      console.error("[useAuth] getSession exception:", e);
      setState(s => ({ ...s, loading: false }));
    });

    return () => subscription.unsubscribe();
  }, [fetchEmployee]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isAdmin = useCallback(
    () => !!state.employee && state.employee.role === "admin" && state.employee.status === "active",
    [state.employee]
  );

  const isFounder = useCallback(() => false, []);

  const hasRole = useCallback(
    (role: string) => !!state.employee && state.employee.role === role,
    [state.employee]
  );

  const profile = state.employee
    ? { full_name: state.employee.name, email: state.employee.email ?? "", avatar_url: null }
    : null;

  const roles = state.employee ? [state.employee.role] : [];

  return { ...state, profile, roles, signOut, hasRole, isAdmin, isFounder };
}
