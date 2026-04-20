import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { trackLeadEvent } from "@/lib/leadTracking";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  fetchAdminDiagnostics,
  getAdminAccessMessage,
  getAdminRedirectTarget,
  refreshAndResolveAdminAccess,
  resolveAdminAccess,
  type AdminDiagnosticsResult,
  type AdminRedirectState,
} from "@/lib/adminAccess";

type Step = "email" | "otp";

function devLog(step: string, payload?: unknown) {
  if (!import.meta.env.DEV) return;
  if (payload === undefined) {
    console.info(`[admin-login] ${step}`);
    return;
  }
  console.info(`[admin-login] ${step}`, payload);
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diag, setDiag] = useState<AdminDiagnosticsResult | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const redirectingRef = useRef(false);
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as AdminRedirectState | null) ?? null;
  const redirectTarget = useMemo(() => getAdminRedirectTarget(routeState?.from), [routeState?.from]);

  // Tick down the resend cooldown each second
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);


  const handleResolvedAccess = async (result: Awaited<ReturnType<typeof resolveAdminAccess>>) => {
    if (result.diagnostics) setDiag(result.diagnostics);

    if (result.isAdmin && result.session && !redirectingRef.current) {
      redirectingRef.current = true;
      setAccessMessage(null);
      setOtp("");
      setStep("email");
      devLog("final redirect target", redirectTarget);
      navigate(redirectTarget, { replace: true });
      return;
    }

    if (result.session && !result.isAdmin) {
      setAccessMessage(getAdminAccessMessage(result));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const result = await resolveAdminAccess();
      if (cancelled || !result.session) return;
      await handleResolvedAccess(result);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTarget]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "INITIAL_SESSION") return;
      void (async () => {
        const result = await resolveAdminAccess(session);
        await handleResolvedAccess(result);
      })();
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTarget]);

  useEffect(() => {
    const routeMessage = routeState?.accessDenied;
    if (routeMessage) setAccessMessage(routeMessage);
  }, [routeState]);

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
    redirectingRef.current = false;
    setAccessMessage(null);
    if (!isResend) setDiag(null);
    setOtp("");
    devLog("OTP requested", { email: normalizedEmail, isResend });

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
        const friendlyMessage = /user|signup|not allowed|not found/i.test(msg) ? "Access not configured" : msg;
        setAccessMessage(friendlyMessage);
        toast.error(friendlyMessage);
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
    redirectingRef.current = false;
    setAccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp,
      type: "email",
    });

    devLog("OTP verified", { email: normalizedEmail, hasSession: !!data.session, error: error?.message ?? null });

    const session = data.session ?? (await supabase.auth.getSession()).data.session;
    if (error || !session) {
      trackLeadEvent({
        event_type: "login_failed",
        email: normalizedEmail,
        role_attempted: "admin",
        success: false,
        failure_reason: error?.message ?? "otp_invalid",
        route: "/admin/login",
      });
      const friendlyMessage = error?.message ?? "OTP verified but no session was created";
      setAccessMessage(friendlyMessage);
      toast.error(friendlyMessage);
      setLoading(false);
      return;
    }

    const result = await refreshAndResolveAdminAccess(session);
    if (result.diagnostics) setDiag(result.diagnostics);

    if (!result.session || !result.isAdmin) {
      await supabase.auth.signOut();
      const message = getAdminAccessMessage(result);
      setAccessMessage(message);
      toast.error(message);
      setLoading(false);
      return;
    }

    trackLeadEvent({
      event_type: "login_success",
      email: result.user?.email?.toLowerCase() ?? normalizedEmail,
      user_id: result.user?.id ?? null,
      role_attempted: "admin",
      success: true,
      route: "/admin/login",
    });

    setOtp("");
    setDiag(result.diagnostics);
    toast.success("Signed in 🚀");
    await handleResolvedAccess(result);
    setLoading(false);
  };

  const handleResetEmail = () => {
    setStep("email");
    setOtp("");
    setAccessMessage(null);
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
      const result = await fetchAdminDiagnostics(normalizedEmail);
      setDiag(result);
      setAccessMessage(result.canAccessAdmin ? null : getAdminAccessMessage({ error: null, diagnostics: result }));
    } catch (err: any) {
      toast.error(err?.message ?? "Diagnostics failed");
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-pixo-surface py-8">
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

              {accessMessage && (
                <p className="text-sm text-destructive text-center">{accessMessage}</p>
              )}
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
                  onClick={() => void handleSendOtp({ preventDefault() {} } as React.FormEvent, true)}
                  className="text-primary underline disabled:text-muted-foreground disabled:no-underline"
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>

              {accessMessage && (
                <p className="text-sm text-destructive text-center">{accessMessage}</p>
              )}
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
