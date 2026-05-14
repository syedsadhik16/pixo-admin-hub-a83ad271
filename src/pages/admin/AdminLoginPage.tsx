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
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import {
  fetchAdminDiagnostics,
  getAdminAccessMessage,
  getAdminRedirectTarget,
  refreshAndResolveAdminAccess,
  resolveAdminAccess,
  type AdminDiagnosticsResult,
  type AdminRedirectState,
} from "@/lib/adminAccess";

type Mode = "password" | "otp";
type Step = "email" | "otp";

function devLog(step: string, payload?: unknown) {
  if (!import.meta.env.DEV) return;
  if (payload === undefined) console.info(`[admin-login] ${step}`);
  else console.info(`[admin-login] ${step}`, payload);
}

export default function AdminLoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setPassword("");
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
    (async () => {
      const result = await resolveAdminAccess();
      if (cancelled || !result.session) return;
      await handleResolvedAccess(result);
    })();
    return () => { cancelled = true; };
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    setAccessMessage(null);
    redirectingRef.current = false;
    devLog("password login attempt", { email: normalizedEmail });

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

    if (error || !data.session) {
      const msg = error?.message ?? "Invalid credentials";
      trackLeadEvent({
        event_type: "login_failed",
        email: normalizedEmail,
        role_attempted: "admin",
        success: false,
        failure_reason: msg,
        route: "/admin/login",
      });
      setAccessMessage(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    const result = await refreshAndResolveAdminAccess(data.session);
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

    setPassword("");
    toast.success("Signed in 🚀");
    await handleResolvedAccess(result);
    setLoading(false);
  };

  const handleSendOtp = async (e: React.FormEvent, isResend = false) => {
    e.preventDefault();
    if (resendCooldown > 0) {
      toast.error(`Please wait ${resendCooldown}s before requesting another code`);
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { toast.error("Enter your admin email"); return; }

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
      options: { shouldCreateUser: false },
    });

    if (error) {
      const msg = error.message || "Failed to send code";
      if (/rate|too many|seconds/i.test(msg)) {
        toast.error(`Rate limited: ${msg}`);
        setResendCooldown(60);
      } else {
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
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    redirectingRef.current = false;
    setAccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp,
      type: "email",
    });

    const session = data.session ?? (await supabase.auth.getSession()).data.session;
    if (error || !session) {
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

    setOtp("");
    toast.success("Signed in 🚀");
    await handleResolvedAccess(result);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin/login` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { toast.error("Enter your email first"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email");
    setLoading(false);
  };

  const runDiagnostics = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { toast.error("Enter an email to diagnose"); return; }
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
    <main className="min-h-screen flex flex-col items-center justify-center bg-pixo-surface py-8">
      <PageHead
        title="Login — PIXO Brain"
        description="Sign in to PIXO Brain, the admin hub for PIXO Learn."
        canonical="/admin/login"
      />
      <h1 className="sr-only">Sign in to PIXO Brain</h1>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl pixo-gradient flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">P</span>
          </div>
          <CardTitle className="text-xl">PIXO Admin Panel</CardTitle>
          <CardDescription>
            {mode === "password"
              ? "Sign in with your admin email and password"
              : step === "email"
                ? "Sign in with a one-time code sent to your admin email"
                : `Enter the 6-digit code sent to ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => { setMode("password"); setStep("email"); setAccessMessage(null); }}
              className={`text-sm py-1.5 rounded-md transition ${mode === "password" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setAccessMessage(null); }}
              className={`text-sm py-1.5 rounded-md transition ${mode === "otp" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Email OTP
            </button>
          </div>

          {mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@pixolearn.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary underline"
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>

              {accessMessage && (
                <p className="text-sm text-destructive text-center">{accessMessage}</p>
              )}
            </form>
          ) : step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email-otp">Admin email</Label>
                <Input
                  id="admin-email-otp"
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
              {accessMessage && (
                <p className="text-sm text-destructive text-center">{accessMessage}</p>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-otp-code">One-time code</Label>
                <div className="flex justify-center">
                  <InputOTP id="admin-otp-code" maxLength={6} value={otp} onChange={setOtp} aria-label="One-time code">
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
                  onClick={() => { setStep("email"); setOtp(""); setAccessMessage(null); }}
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

          {/* Divider + other options */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Only approved admin accounts can sign in.
          </p>
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
