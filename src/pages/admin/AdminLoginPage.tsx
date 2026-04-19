import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { trackLeadEvent } from "@/lib/leadTracking";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Step = "email" | "otp";

interface DiagnosticsResult {
  hasAuthUser: boolean;
  hasEmployeeProfile: boolean;
  employeeRole: string | null;
  employeeStatus: string | null;
  hasAdminRole: boolean;
  canAccessAdmin: boolean;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diag, setDiag] = useState<DiagnosticsResult | null>(null);
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();

  // Tick down the resend cooldown each second
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);


  // If already signed in as admin, skip login
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled || !session?.user?.email) return;
      const { data: emp } = await supabase
        .from("employee_profiles")
        .select("role, status")
        .ilike("email", session.user.email)
        .maybeSingle();
      if (emp && emp.role === "admin" && emp.status === "active") {
        navigate("/admin/dashboard", { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSendOtp = async (e: React.FormEvent, isResend = false) => {
    e.preventDefault();
    if (resendCooldown > 0) {
      toast.error(`Please wait ${resendCooldown}s before requesting another code`);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter your admin email");
      return;
    }

    setLoading(true);

    trackLeadEvent({
      event_type: "login_attempt",
      email: normalizedEmail,
      role_attempted: "admin",
      route: "/admin/login",
    });

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin/dashboard`,
      },
    });

    if (error) {
      const msg = error.message || "Failed to send code";

      if (/rate|too many|seconds/i.test(msg)) {
        toast.error(`Rate limited: ${msg}`);
        setResendCooldown(60);
      } else {
        trackLeadEvent({
          event_type: "login_failed",
          email: normalizedEmail,
          role_attempted: "admin",
          success: false,
          failure_reason: msg,
          route: "/admin/login",
        });
        toast.error(/user|signup|not allowed|not found/i.test(msg) ? "Access not configured" : msg);
      }

      setLoading(false);
      return;
    }

    toast.success(isResend ? "New code sent" : "Check your email for the 6-digit code");
    setStep("otp");
    setResendCooldown(60);
    setLoading(false);
  };


  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp,
      type: "email",
    });

    if (error || !data.session) {
      trackLeadEvent({
        event_type: "login_failed",
        email: normalizedEmail,
        role_attempted: "admin",
        success: false,
        failure_reason: error?.message ?? "otp_invalid",
        route: "/admin/login",
      });
      toast.error(error?.message ?? "Invalid or expired code");
      setLoading(false);
      return;
    }

    // Final server-side authorization
    const sessionEmail = data.user?.email?.toLowerCase() ?? normalizedEmail;
    const { data: emp, error: empErr } = await supabase
      .from("employee_profiles")
      .select("role, status")
      .ilike("email", sessionEmail)
      .maybeSingle();

    if (empErr || !emp || emp.role !== "admin" || emp.status !== "active") {
      await supabase.auth.signOut();
      toast.error("Access not configured");
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

    toast.success("Signed in 🚀");
    navigate("/admin/dashboard", { replace: true });
    setLoading(false);
  };

  const handleResetEmail = () => {
    setStep("email");
    setOtp("");
  };

  const runDiagnostics = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter an email to diagnose");
      return;
    }
    setDiagLoading(true);
    setDiag(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-access-check", {
        body: { email: normalizedEmail },
      });
      if (error) throw error;
      setDiag(data as DiagnosticsResult);
    } catch (err: any) {
      toast.error(err?.message ?? "Diagnostics failed");
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pixo-surface">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl pixo-gradient flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">P</span>
          </div>
          <CardTitle className="text-xl">PIXO Admin Panel</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Sign in with a one-time code sent to your admin email"
              : `Enter the 6-digit code sent to ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setResendCooldown(0); }}
                  placeholder="you@pixolearn.com"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending code…" : "Send OTP"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Only approved admin accounts can sign in.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>One-time code</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying…" : "Verify & sign in"}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResetEmail}
                  className="text-muted-foreground underline"
                  disabled={loading}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSendOtp(e as unknown as React.FormEvent, true)}
                  className="text-primary underline disabled:text-muted-foreground disabled:no-underline"
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {isDev && (
        <Card className="w-full max-w-md mx-4 mt-4 border-dashed border-pixo-amber/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono-label uppercase tracking-wide text-pixo-amber">
              Dev · Access Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">
              Check whether an email has an auth user, employee profile, and admin role. Visible in development only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={diagLoading || !email.trim()}
              className="w-full"
            >
              {diagLoading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Checking…</>
              ) : (
                "Run diagnostics for this email"
              )}
            </Button>

            {diag && (
              <div className="space-y-1.5 text-xs">
                <DiagRow label="Auth user exists" ok={diag.hasAuthUser} />
                <DiagRow label="Employee profile exists" ok={diag.hasEmployeeProfile} />
                <DiagRow
                  label={`Employee role = admin${diag.employeeRole ? ` (current: ${diag.employeeRole})` : ""}`}
                  ok={diag.employeeRole === "admin"}
                />
                <DiagRow
                  label={`Employee status = active${diag.employeeStatus ? ` (current: ${diag.employeeStatus})` : ""}`}
                  ok={diag.employeeStatus === "active"}
                />
                <DiagRow label="user_roles has admin row" ok={diag.hasAdminRole} />
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                  <span className="font-medium">Can access /admin/*</span>
                  {diag.canAccessAdmin ? (
                    <span className="text-pixo-green font-mono-label text-[11px]">YES</span>
                  ) : (
                    <span className="text-destructive font-mono-label text-[11px]">NO</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiagRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-pixo-green shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
