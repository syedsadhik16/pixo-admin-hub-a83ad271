import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { resolveAdminAccess } from "@/lib/adminAccess";

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

  const syncAuthState = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, session: null, employee: null, loading: false, accessError: null });
      return;
    }

    const result = await resolveAdminAccess(session);
    setState({
      user: result.user,
      session: result.session,
      employee: (result.employee as EmployeeRecord | null) ?? null,
      loading: false,
      accessError: result.error,
    });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthState(session);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await syncAuthState(session);
    }).catch(e => {
      console.error("[useAuth] getSession exception:", e);
      setState(s => ({ ...s, loading: false }));
    });

    return () => subscription.unsubscribe();
  }, [syncAuthState]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, employee: null, loading: false, accessError: null });
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
