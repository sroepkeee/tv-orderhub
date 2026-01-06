import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WaitingForInviteScreen } from "./WaitingForInviteScreen";

interface OrganizationGuardProps {
  children: React.ReactNode;
}

/**
 * Guard que verifica se o usuário tem uma organização.
 * - Se tem organização: renderiza children
 * - Se não tem organização + é admin: redireciona para /onboarding
 * - Se não tem organização + NÃO é admin: mostra tela de "Aguardando Convite"
 * 
 * Páginas isentas: /landing, /auth, /onboarding
 */
export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasOrg, setHasOrg] = useState(false);
  const [showWaitingScreen, setShowWaitingScreen] = useState(false);

  // Páginas que não precisam de organização
  const exemptPaths = ['/landing', '/auth', '/onboarding'];
  const isExemptPath = exemptPaths.some(path => 
    location.pathname === path || location.pathname.startsWith(path + '/')
  );

  useEffect(() => {
    const checkOrganization = async () => {
      // Se é página isenta, não precisa verificar
      if (isExemptPath) {
        setChecking(false);
        setHasOrg(true);
        return;
      }

      // Se não está autenticado, deixar o ProtectedRoute lidar
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        // 1. Verificar se tem organização
        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (membershipError) {
          console.error('Error checking organization membership:', membershipError);
          // Em caso de erro, permitir continuar (comportamento graceful)
          setHasOrg(true);
          setChecking(false);
          return;
        }

        if (membership?.organization_id) {
          setHasOrg(true);
          setChecking(false);
          return;
        }

        // 2. Usuário não tem organização - verificar se é admin
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error checking user roles:', rolesError);
          // Em caso de erro, mostrar tela de espera (comportamento seguro)
          setShowWaitingScreen(true);
          setChecking(false);
          return;
        }

        const isAdmin = roles?.some(r => r.role === 'admin');

        if (isAdmin) {
          // Admin pode criar organização
          navigate('/onboarding', { replace: true });
          return;
        } else {
          // Usuário comum sem organização - mostrar tela de espera
          setShowWaitingScreen(true);
        }
      } catch (error) {
        console.error('Error in OrganizationGuard:', error);
        // Em caso de erro inesperado, permitir continuar
        setHasOrg(true);
      }

      setChecking(false);
    };

    if (!authLoading) {
      checkOrganization();
    }
  }, [user, authLoading, isExemptPath, navigate]);

  // Se está checando, mostrar loading
  if (checking && !isExemptPath && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando organização...</p>
        </div>
      </div>
    );
  }

  // Se deve mostrar tela de espera (usuário não-admin sem organização)
  if (showWaitingScreen) {
    return <WaitingForInviteScreen />;
  }

  return <>{children}</>;
}
