import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Bell, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminTopbarProps {
  title?: string;
  subtitle?: string;
}

export function AdminTopbar({ title, subtitle }: AdminTopbarProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out");
    navigate("/admin/login", { replace: true });
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        {title && (
          <div>
            <h1 className="text-sm font-semibold">{title}</h1>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Query system intelligence..."
          className="h-8 w-56 text-xs bg-muted/50 border-0 hidden lg:block"
        />
        <Badge variant="outline" className="font-mono-label text-[9px] border-pixo-green/30 text-pixo-green hidden sm:inline-flex">
          V3.1.2
        </Badge>
        <Badge variant="outline" className="font-mono-label text-[9px] border-pixo-amber/30 text-pixo-amber hidden sm:inline-flex">
          STAGING
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
