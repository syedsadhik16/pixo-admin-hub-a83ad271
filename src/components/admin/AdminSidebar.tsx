import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, CreditCard, Users, BookOpen, Brain, Palette,
  Heart, Server, Shield, Search, LogOut, Zap,
  Target, Filter, TrendingUp, Activity, Download, IndianRupee, Flame, Building2, CalendarCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const analyticsItems = [
  { title: "Founder HQ", url: "/admin/founder-hq", icon: Shield, founderOnly: true },
  { title: "Dashboard", url: "/admin/dashboard", icon: BarChart3 },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Employees", url: "/admin/employees", icon: Users },
];

const operationsItems = [
  { title: "CRM / Leads", url: "/admin/crm", icon: Target },
  { title: "Leads & Logins", url: "/admin/leads", icon: Flame },
  { title: "B2B Orgs", url: "/admin/b2b", icon: Building2 },
  { title: "Payment Funnel", url: "/admin/funnel", icon: Filter },
  { title: "Sales & Commission", url: "/admin/sales", icon: IndianRupee },
  { title: "Progress", url: "/admin/progress", icon: TrendingUp },
  { title: "Activity", url: "/admin/activity", icon: Activity },
  { title: "Exports", url: "/admin/exports", icon: Download },
];

const curriculumItems = [
  { title: "Curriculum", url: "/admin/curriculum", icon: BookOpen },
  { title: "AI Behavior", url: "/admin/ai-behavior", icon: Brain },
  { title: "UI & Visuals", url: "/admin/ui-experience", icon: Palette },
];

const systemItems = [
  { title: "Parent Connect", url: "/admin/parent-connect", icon: Heart },
  { title: "Architecture", url: "/admin/architecture", icon: Server },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut, isFounder } = useAuthContext();
  const [search, setSearch] = useState("");

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const renderItems = (items: typeof analyticsItems) => {
    const filtered = items
      .filter(i => !i.founderOnly || isFounder())
      .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()));

    return filtered.map(item => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink to={item.url} end={false} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium">
            <item.icon className="mr-2 h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  };

  const primaryRole = roles[0] ?? "admin";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-9 w-9 rounded-lg pixo-gradient flex items-center justify-center">
              <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground tracking-tight">PIXO BRAIN</h2>
              <p className="font-mono-label text-sidebar-foreground/40">ADMIN PANEL</p>
            </div>
          </div>
        )}
        {!collapsed && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sidebar-foreground/30" />
            <Input
              placeholder="Search modules..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono-label text-sidebar-foreground/40">Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(analyticsItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono-label text-sidebar-foreground/40">Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(operationsItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono-label text-sidebar-foreground/40">Curriculum & AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(curriculumItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono-label text-sidebar-foreground/40">System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(systemItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {!collapsed && (
          <>
            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-sidebar-border text-sidebar-foreground/70 bg-sidebar-accent/30 hover:bg-sidebar-accent/50">
              <Zap className="h-3 w-3 mr-1.5" />
              Global Sync
            </Button>
            <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/30 p-2.5">
              <div className="h-8 w-8 rounded-full pixo-gradient flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || "Admin"}</p>
                <Badge variant="outline" className="font-mono-label text-[8px] px-1.5 py-0 border-sidebar-primary/40 text-sidebar-primary">
                  {primaryRole}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void handleSignOut()} className="h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
