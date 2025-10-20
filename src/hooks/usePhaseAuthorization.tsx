import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const usePhaseAuthorization = () => {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserRoles();
    }
  }, [user]);

  const loadUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (error) throw error;
      setUserRoles(data?.map((r: any) => r.role) || []);
    } catch (error) {
      console.error('Error loading roles:', error);
      setUserRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const canEditPhase = (phase: string): boolean => {
    if (userRoles.includes('admin')) return true;
    
    const phaseRoleMap: Record<string, string> = {
      'almox_ssm': 'almox_ssm',
      'order_generation': 'planejamento',
      'almox_general': 'almox_geral',
      'production': 'producao',
      'balance_generation': 'faturamento',
      'laboratory': 'laboratorio',
      'packaging': 'logistica',
      'freight_quote': 'comercial',
      'invoicing': 'faturamento',
      'logistics': 'logistica',
      'completion': 'admin',
      'exceptions': 'admin',
    };

    return userRoles.includes(phaseRoleMap[phase]);
  };

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role) || userRoles.includes('admin');
  };

  return { userRoles, canEditPhase, hasRole, loading };
};
