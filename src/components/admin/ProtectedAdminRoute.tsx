import { forwardRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { DEV_BYPASS_AUTH } from "@/lib/devAuth";

export const ProtectedAdminRoute = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function ProtectedAdminRoute({ children }, _ref) {
    // 🔓 Dev bypass: skip all auth checks while flag is on.
    if (DEV_BYPASS_AUTH) {
      return <>{children}</>;
    }

    const { user, loading, isAdmin, accessError } = useAuthContext();

    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center bg-pixo-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    if (!user) return <Navigate to="/admin/login" replace />;
    if (!isAdmin()) {
      return (
        <div className="flex h-screen items-center justify-center bg-pixo-surface">
          <div className="max-w-md text-center space-y-3 p-6">
            <h2 className="text-lg font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground">{accessError ?? "Admin role required."}</p>
            <Navigate to="/admin/login" replace />
          </div>
        </div>
      );
    }

    return <>{children}</>;
  }
);
