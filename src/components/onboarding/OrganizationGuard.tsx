import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OrganizationGuardProps {
  children: React.ReactNode;
}

/**
 * Guard que verifica se o usuário tem uma organização.
 * Se não tiver, redireciona para o onboarding.
 * Páginas isentas: /landing, /auth, /onboarding
 */
export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasOrg, setHasOrg] = useState(false);

  // Páginas que não precisam de organização
  const exemptPaths = ['/landing', '/auth', '/onboarding'];
  const isExemptPath = exemptPaths.some(path => location.pathname.startsWith(path));

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
        const { data, error } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (data?.organization_id) {
          setHasOrg(true);
        } else {
          // Usuário não tem organização - redirecionar para onboarding
          navigate('/onboarding', { replace: true });
          return;
        }
      } catch (error) {
        console.error('Error checking organization:', error);
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

  return <>{children}</>;
}
