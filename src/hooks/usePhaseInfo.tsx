import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/components/Dashboard';

interface PhaseConfig {
  phase_key: string;
  display_name: string;
  responsible_role: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface PhaseInfo {
  displayName: string;
  responsibleRole: string;
  responsibleUsers: UserProfile[];
}

export const usePhaseInfo = () => {
  const [phaseConfigs, setPhaseConfigs] = useState<PhaseConfig[]>([]);
  const [usersByRole, setUsersByRole] = useState<Map<string, UserProfile[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhaseData();
  }, []);

  const loadPhaseData = async () => {
    try {
      // Buscar configurações de fases
      const { data: phaseData, error: phaseError } = await supabase
        .from('phase_config')
        .select('phase_key, display_name, responsible_role')
        .order('order_index');

      if (phaseError) throw phaseError;
      setPhaseConfigs(phaseData || []);

      // Buscar usuários de todas as roles
      const { data: usersData, error: usersError } = await supabase
        .from('user_roles')
        .select(`
          role,
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `);

      if (usersError) throw usersError;

      // Agrupar usuários por role
      const roleMap = new Map<string, UserProfile[]>();
      usersData?.forEach((ur: any) => {
        if (ur.profiles) {
          const users = roleMap.get(ur.role) || [];
          users.push({
            id: ur.profiles.id,
            full_name: ur.profiles.full_name || ur.profiles.email || 'Usuário',
            email: ur.profiles.email
          });
          roleMap.set(ur.role, users);
        }
      });

      setUsersByRole(roleMap);
    } catch (error) {
      console.error('Error loading phase data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPhaseFromStatus = (status: Order['status']): string => {
    // Mapear status para phase_key (sincronizado com novos phase_keys)
    const statusPhaseMap: Record<string, string> = {
      'pendente': 'almox_ssm',
      'em_triagem': 'almox_ssm',
      'aguardando_aprovacao': 'order_generation',
      'em_compra': 'order_generation',
      'em_producao': 'production',
      'em_laboratorio': 'laboratory',
      'aguardando_expedicao': 'logistics',
      'em_expedicao': 'logistics',
      'enviado': 'logistics',
      'concluido': 'invoicing'
    };

    return statusPhaseMap[status] || 'almox_ssm';
  };

  const getPhaseInfo = (status: Order['status']): PhaseInfo | null => {
    const phaseKey = getPhaseFromStatus(status);
    const phaseConfig = phaseConfigs.find(pc => pc.phase_key === phaseKey);
    
    if (!phaseConfig) return null;

    const responsibleUsers = usersByRole.get(phaseConfig.responsible_role) || [];

    return {
      displayName: phaseConfig.display_name,
      responsibleRole: phaseConfig.responsible_role,
      responsibleUsers
    };
  };

  return { getPhaseInfo, loading };
};
