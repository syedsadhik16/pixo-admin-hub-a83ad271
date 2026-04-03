import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuthContext();

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
  if (!isAdmin()) return <Navigate to="/" replace />;

  return <>{children}</>;
}
