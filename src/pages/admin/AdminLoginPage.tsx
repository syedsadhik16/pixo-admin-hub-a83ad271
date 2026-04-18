import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DEV_BYPASS_AUTH } from "@/lib/devAuth";
import { trackLeadEvent } from "@/lib/leadTracking";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@pixolearn.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // 🔓 Dev bypass: skip the login screen entirely.
  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [navigate]);

  if (DEV_BYPASS_AUTH) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pixo-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Entering admin…</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    console.log("[AdminLogin] project:", { projectRef, supabaseUrl });
    console.log("[AdminLogin] login email:", normalizedEmail);

    // Track the attempt up-front so failures are also captured.
    trackLeadEvent({
      event_type: "login_attempt",
      email: normalizedEmail,
      role_attempted: "admin",
      route: "/admin/login",
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    console.log("[AdminLogin] auth response:", data);

    if (error) {
      console.error("[AdminLogin] auth error:", error);
      trackLeadEvent({
        event_type: "login_failed",
        email: normalizedEmail,
        role_attempted: "admin",
        success: false,
        failure_reason: error.message,
        route: "/admin/login",
      });
      toast.error(error.message || "Invalid login credentials");
      setLoading(false);
      return;
    }

    const sessionEmail = data.user?.email?.toLowerCase() || normalizedEmail;

    const { data: emp, error: empErr } = await supabase
      .from("employee_profiles")
      .select("id, role, status, email")
      .ilike("email", sessionEmail)
      .maybeSingle();

    if (empErr) {
      await supabase.auth.signOut();
      toast.error(empErr.message);
      setLoading(false);
      return;
    }

    if (!emp) {
      await supabase.auth.signOut();
      toast.error("Access not configured");
      setLoading(false);
      return;
    }

    if (emp.status !== "active") {
      await supabase.auth.signOut();
      toast.error("Account inactive");
      setLoading(false);
      return;
    }

    if (emp.role !== "admin") {
      await supabase.auth.signOut();
      toast.error("Admin access required");
      setLoading(false);
      return;
    }

    trackLeadEvent({
      event_type: "login_success",
      email: sessionEmail,
      user_id: data.user?.id ?? null,
      role_attempted: "admin",
      success: true,
      route: "/admin/login",
    });

    toast.success("Login success 🚀");
    navigate("/admin/dashboard");
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pixo-surface">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl pixo-gradient flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">P</span>
          </div>
          <CardTitle className="text-xl">PIXO Admin Panel</CardTitle>
          <CardDescription>Sign in with your admin credentials</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center text-sm">
              <button type="button" onClick={handleForgotPassword} className="text-primary underline">
                Forgot password?
              </button>
            </div>

            <div className="text-xs text-gray-400 text-center">Default admin email: admin@pixolearn.com</div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
