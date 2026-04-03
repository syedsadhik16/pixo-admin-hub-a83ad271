import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "student" | "parent" | "admin" | "founder" | "staff_support" | "staff_sales" | "staff_content";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { full_name: string; email: string; avatar_url: string | null } | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    profile: null,
    loading: true,
  });

  const fetchRolesAndProfile = useCallback(async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).single(),
    ]);

    const roles = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
    const profile = profileRes.data ?? null;
    return { roles, profile };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { roles, profile } = await fetchRolesAndProfile(session.user.id);
        setState({ user: session.user, session, roles, profile, loading: false });
      } else {
        setState({ user: null, session: null, roles: [], profile: null, loading: false });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { roles, profile } = await fetchRolesAndProfile(session.user.id);
        setState({ user: session.user, session, roles, profile, loading: false });
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRolesAndProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const hasRole = useCallback((role: AppRole) => state.roles.includes(role), [state.roles]);

  const isAdmin = useCallback(() => 
    state.roles.some(r => ["admin", "founder", "staff_support", "staff_sales", "staff_content"].includes(r)),
    [state.roles]
  );

  const isFounder = useCallback(() => state.roles.includes("founder"), [state.roles]);

  return { ...state, signOut, hasRole, isAdmin, isFounder };
}
