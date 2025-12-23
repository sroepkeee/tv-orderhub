import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Metrics from "./pages/Metrics";
import Production from "./pages/Production";
import CarriersChat from "./pages/CarriersChat";
import Carriers from "./pages/Carriers";
import Admin from "./pages/Admin";
import Purchases from "./pages/Purchases";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import AIAgent from "./pages/AIAgent";
import Customers from "./pages/Customers";
import Onboarding from "./pages/Onboarding";
import PhaseSettings from "./pages/PhaseSettings";
import Files from "./pages/Files";
import { CarriersChatRoute } from "./components/CarriersChatRoute";
import { useAuth } from "./hooks/useAuth";
import { usePermissions } from "./contexts/PermissionsContext";
import { PendingApprovalScreen } from "./components/PendingApprovalScreen";
import { CompleteProfileDialog } from "./components/CompleteProfileDialog";
import { VisualModeProvider } from "./hooks/useVisualMode";
import { PrivacyModeProvider } from "./hooks/usePrivacyMode";
import { OrganizationProvider } from "./hooks/useOrganization";
import { OrganizationGuard } from "./components/onboarding/OrganizationGuard";
import { AuthProvider } from "./contexts/AuthContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isApproved, loading: permissionsLoading } = usePermissions();
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    const checkProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('department, location')
          .eq('id', user.id)
          .single();
        
        if (profile && (!profile.department || !profile.location)) {
          setProfileIncomplete(true);
        }
      }
      setCheckingProfile(false);
    };
    
    if (!loading && user) {
      checkProfile();
    } else if (!loading) {
      setCheckingProfile(false);
    }
  }, [user, loading]);

  // Timeout de segurança para evitar loading infinito
  useEffect(() => {
    const isStillLoading = loading || permissionsLoading || checkingProfile || isApproved === null;
    
    if (!isStillLoading) {
      setLoadingTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      console.warn('⚠️ [ProtectedRoute] Loading timeout reached after 8s - forcing render');
      setLoadingTimeout(true);
    }, 8000); // 8 segundos de timeout

    return () => clearTimeout(timer);
  }, [loading, permissionsLoading, checkingProfile, isApproved]);
  
  // Mostrar loading enquanto auth, permissionsLoading ou checkingProfile estiverem ativos
  // OU enquanto isApproved for null (ainda carregando status de aprovação)
  // MAS respeitar timeout de segurança
  const isStillLoading = loading || permissionsLoading || checkingProfile || isApproved === null;
  
  if (isStillLoading && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profileIncomplete) {
    return <CompleteProfileDialog open={true} userId={user.id} userEmail={user.email} />;
  }

  // Somente mostrar PendingApprovalScreen quando isApproved === false (explicitamente pendente)
  // Se loadingTimeout ativo e isApproved ainda null, considerar como aprovado (legado)
  if (isApproved === false) {
    return <PendingApprovalScreen />;
  }
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = usePermissions();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground mb-6">
            Você não tem permissão para acessar esta página. 
            Apenas administradores podem gerenciar usuários.
          </p>
          <Button onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <PrivacyModeProvider>
            <VisualModeProvider>
              <OrganizationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <OrganizationGuard>
                      <Routes>
                        <Route path="/landing" element={<Landing />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/onboarding" element={
                          <ProtectedRoute>
                            <Onboarding />
                          </ProtectedRoute>
                        } />
                        <Route path="/" element={
                          <ProtectedRoute>
                            <Index />
                          </ProtectedRoute>
                        } />
                        <Route path="/metrics" element={
                          <ProtectedRoute>
                            <Metrics />
                          </ProtectedRoute>
                        } />
                        <Route path="/producao" element={
                          <ProtectedRoute>
                            <Production />
                          </ProtectedRoute>
                        } />
                        <Route path="/carriers-chat" element={
                          <ProtectedRoute>
                            <CarriersChatRoute>
                              <CarriersChat />
                            </CarriersChatRoute>
                          </ProtectedRoute>
                        } />
                        <Route path="/transportadoras" element={
                          <ProtectedRoute>
                            <Carriers />
                          </ProtectedRoute>
                        } />
                        <Route path="/admin/users" element={
                          <ProtectedRoute>
                            <AdminRoute>
                              <Admin />
                            </AdminRoute>
                          </ProtectedRoute>
                        } />
                        <Route path="/compras" element={
                          <ProtectedRoute>
                            <Purchases />
                          </ProtectedRoute>
                        } />
                        <Route path="/whatsapp-settings" element={
                          <ProtectedRoute>
                            <WhatsAppSettings />
                          </ProtectedRoute>
                        } />
                        <Route path="/ai-agent" element={
                          <ProtectedRoute>
                            <AIAgent />
                          </ProtectedRoute>
                        } />
                        <Route path="/customers" element={
                          <ProtectedRoute>
                            <Customers />
                          </ProtectedRoute>
                        } />
                        <Route path="/files" element={
                          <ProtectedRoute>
                            <Files />
                          </ProtectedRoute>
                        } />
                        <Route path="/settings/phases" element={
                          <ProtectedRoute>
                            <AdminRoute>
                              <PhaseSettings />
                            </AdminRoute>
                          </ProtectedRoute>
                        } />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </OrganizationGuard>
                  </BrowserRouter>
                </TooltipProvider>
              </OrganizationProvider>
            </VisualModeProvider>
          </PrivacyModeProvider>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
