import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Briefcase, TrendingUp } from "lucide-react";

interface InviteMeta {
  id: string;
  category: "office" | "commission";
  designation: string | null;
  preset_role: string | null;
  invited_email: string | null;
  status: string;
}

const OFFICE_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "developer", label: "Developer" },
  { value: "ops", label: "Operations" },
  { value: "support", label: "Support" },
  { value: "content", label: "Content" },
  { value: "staff", label: "Staff" },
];
const COMMISSION_ROLES = [
  { value: "sales", label: "Sales" },
  { value: "field_sales", label: "Field Sales" },
  { value: "tele_sales", label: "Tele Sales" },
  { value: "partner", label: "Partner" },
];

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invite, setInvite] = useState<InviteMeta | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    employee_code: "",
    designation: "",
    role: "",
    password: "",
    confirm: "",
  });

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("No invite token provided");
        setLoading(false);
        return;
      }
      try {
        const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/accept-employee-invite?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid invite");
        } else {
          setInvite(data.invite);
          setForm((f) => ({
            ...f,
            email: data.invite.invited_email ?? "",
            designation: data.invite.designation ?? "",
            role: data.invite.preset_role ?? "",
          }));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit() {
    if (!invite) return;
    if (!form.full_name || !form.email || !form.password || !form.employee_code) {
      toast.error("Please fill all required fields");
      return;
    }
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (form.password !== form.confirm) return toast.error("Passwords don't match");

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-employee-invite", {
        body: {
          token,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          designation: form.designation,
          employee_code: form.employee_code,
          role: form.role || invite.preset_role,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDone(true);
      toast.success("Account created! You can now sign in.");
      setTimeout(() => navigate("/admin/login"), 2500);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Invite not valid</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-3">
              Please contact your administrator for a new invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Welcome aboard!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your account has been created. Redirecting you to the login page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleOptions = invite?.category === "commission" ? COMMISSION_ROLES : OFFICE_ROLES;
  const Icon = invite?.category === "commission" ? TrendingUp : Briefcase;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <CardTitle>Join PIXO Learn</CardTitle>
            </div>
            <Badge variant={invite?.category === "commission" ? "default" : "secondary"} className="capitalize">
              {invite?.category === "commission" ? "Commission Based" : "Office Staff"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Complete your profile to activate your account.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Employee Code *</Label>
              <Input value={form.employee_code} onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))} placeholder="e.g. EMP010" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!invite?.invited_email} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))} disabled={!!invite?.preset_role}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Developer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm Password *</Label>
              <Input type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          {invite?.category === "commission" && (
            <p className="text-[11px] text-muted-foreground bg-muted p-2 rounded">
              💼 Commission slabs: ₹2000 (≥₹14,999) · ₹1500 (≥₹9,999) · ₹1000 (≥₹5,999)
            </p>
          )}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Creating account..." : "Complete Onboarding"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
