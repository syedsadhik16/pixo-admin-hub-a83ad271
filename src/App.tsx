import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminResetPasswordPage from "./pages/admin/AdminResetPasswordPage";
import FounderHQPage from "./pages/admin/FounderHQPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import PaymentsPage from "./pages/admin/PaymentsPage";
import CurriculumPage from "./pages/admin/CurriculumPage";
import EmployeesPage from "./pages/admin/EmployeesPage";
import AIBehaviorPage from "./pages/admin/AIBehaviorPage";
import UIExperiencePage from "./pages/admin/UIExperiencePage";
import ParentConnectPage from "./pages/admin/ParentConnectPage";
import ArchitecturePage from "./pages/admin/ArchitecturePage";
import CRMPage from "./pages/admin/CRMPage";
import FunnelPage from "./pages/admin/FunnelPage";
import ProgressPage from "./pages/admin/ProgressPage";
import ActivityPage from "./pages/admin/ActivityPage";
import ExportsPage from "./pages/admin/ExportsPage";
import SalesPage from "./pages/admin/SalesPage";
import LeadsPage from "./pages/admin/LeadsPage";
import B2BPage from "./pages/admin/B2BPage";
import JoinPage from "./pages/JoinPage";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/founder-hq" element={<ProtectedAdminRoute><FounderHQPage /></ProtectedAdminRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
            <Route path="/admin/payments" element={<ProtectedAdminRoute><PaymentsPage /></ProtectedAdminRoute>} />
            <Route path="/admin/curriculum" element={<ProtectedAdminRoute><CurriculumPage /></ProtectedAdminRoute>} />
            <Route path="/admin/employees" element={<ProtectedAdminRoute><EmployeesPage /></ProtectedAdminRoute>} />
            <Route path="/admin/ai-behavior" element={<ProtectedAdminRoute><AIBehaviorPage /></ProtectedAdminRoute>} />
            <Route path="/admin/ui-experience" element={<ProtectedAdminRoute><UIExperiencePage /></ProtectedAdminRoute>} />
            <Route path="/admin/parent-connect" element={<ProtectedAdminRoute><ParentConnectPage /></ProtectedAdminRoute>} />
            <Route path="/admin/architecture" element={<ProtectedAdminRoute><ArchitecturePage /></ProtectedAdminRoute>} />
            <Route path="/admin/crm" element={<ProtectedAdminRoute><CRMPage /></ProtectedAdminRoute>} />
            <Route path="/admin/funnel" element={<ProtectedAdminRoute><FunnelPage /></ProtectedAdminRoute>} />
            <Route path="/admin/progress" element={<ProtectedAdminRoute><ProgressPage /></ProtectedAdminRoute>} />
            <Route path="/admin/activity" element={<ProtectedAdminRoute><ActivityPage /></ProtectedAdminRoute>} />
            <Route path="/admin/exports" element={<ProtectedAdminRoute><ExportsPage /></ProtectedAdminRoute>} />
            <Route path="/admin/sales" element={<ProtectedAdminRoute><SalesPage /></ProtectedAdminRoute>} />
            <Route path="/admin/leads" element={<ProtectedAdminRoute><LeadsPage /></ProtectedAdminRoute>} />
            <Route path="/admin/b2b" element={<ProtectedAdminRoute><B2BPage /></ProtectedAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
