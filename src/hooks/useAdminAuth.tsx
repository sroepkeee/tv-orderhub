import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook simplificado para verificar se o usuário é admin.
 * Busca diretamente da tabela user_roles, sem dependência de usePhaseAuthorization
 * para evitar dependência circular.
 */
export const useAdminAuth = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const checkAdmin = async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (isMounted) {
          setIsAdmin(!!data);
          setLoading(false);
        }
      } catch (error) {
        console.error('[useAdminAuth] Erro ao verificar admin:', error);
        if (isMounted) {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    };

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return { isAdmin, loading };
};
