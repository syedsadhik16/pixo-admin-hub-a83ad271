import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error("[AdminLogin] auth error:", error);
      toast.error(error.message || "Invalid login credentials");
      setLoading(false);
      return;
    }

    const sessionEmail = data.user?.email ?? email;
    console.log("[AdminLogin] session.user.email:", sessionEmail);

    // Validate against employee_profiles (case-insensitive)
    const { data: emp, error: empErr } = await supabase
      .from("employee_profiles")
      .select("id, role, status, email")
      .ilike("email", sessionEmail)
      .maybeSingle();

    console.log("[AdminLogin] employee_profiles query result:", { emp, empErr });

    if (empErr) {
      await supabase.auth.signOut();
      toast.error(`Lookup failed: ${empErr.message}`);
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
      toast.error("Access denied. Admin role required.");
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate("/admin/dashboard");
    setLoading(false);
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@pixo.ai" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
