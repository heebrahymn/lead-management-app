import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index.tsx";
import Overview from "./pages/Overview.tsx";
import Analytics from "./pages/Analytics.tsx";
import WhatsAppAnalytics from "./pages/WhatsAppAnalytics.tsx";
import Settings from "./pages/Settings.tsx";
import Auth from "./pages/Auth.tsx";
import Users from "./pages/Users.tsx";
import LeadDetail from "./pages/LeadDetail.tsx";
import AuditLogs from "./pages/AuditLogs.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Overview />} />
              <Route path="/leads" element={<Index />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/whatsapp-analytics" element={<WhatsAppAnalytics />} />
              <Route path="/users" element={<Users />} />
              <Route path="/activity-logs" element={<AuditLogs />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

