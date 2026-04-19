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

type Step = "email" | "otp";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
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

    // Pre-check that this email is an active admin (best-effort, server enforces final).
    const { data: emp, error: empErr } = await supabase
      .from("employee_profiles")
      .select("role, status")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (empErr) {
      toast.error(empErr.message);
      setLoading(false);
      return;
    }

    if (!emp || emp.role !== "admin" || emp.status !== "active") {
      trackLeadEvent({
        event_type: "login_failed",
        email: normalizedEmail,
        role_attempted: "admin",
        success: false,
        failure_reason: "not_admin",
        route: "/admin/login",
      });
      toast.error("Access not configured");
      setLoading(false);
      return;
    }

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
      // Surface Supabase rate-limit feedback explicitly
      const msg = error.message || "Failed to send code";
      if (/rate|too many|seconds/i.test(msg)) {
        toast.error(`Rate limited: ${msg}`);
        setResendCooldown(60);
      } else {
        toast.error(msg);
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
    </div>
  );
}
