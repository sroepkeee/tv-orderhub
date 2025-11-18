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

      console.log('🔍 [usePhaseInfo] Query phase_config:', { phaseData, phaseError });

      if (phaseError) throw phaseError;
      setPhaseConfigs(phaseData || []);
      console.log('✅ [usePhaseInfo] Phase configs carregadas:', phaseData?.length || 0);

      // Buscar roles de usuários
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role, user_id');

      if (userRolesError) throw userRolesError;

      // Buscar perfis dos usuários
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (profilesError) throw profilesError;

      // Mapear perfis por id
      const profilesById = new Map<string, UserProfile>();
      profilesData?.forEach((p) => {
        if (!p) return;
        profilesById.set(p.id, {
          id: p.id,
          full_name: p.full_name || p.email || 'Usuário',
          email: p.email,
        });
      });

      // Agrupar usuários por role
      const roleMap = new Map<string, UserProfile[]>();
      userRolesData?.forEach((ur) => {
        const profile = profilesById.get(ur.user_id);
        if (profile) {
          const users = roleMap.get(ur.role) || [];
          users.push(profile);
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
    // Mapear status para phase_key - todos os status do banco
    const statusPhaseMap: Record<string, string> = {
      // Almox SSM
      'almox_ssm_pending': 'almox_ssm',
      'almox_ssm_received': 'almox_ssm',
      'almox_ssm_processing': 'almox_ssm',
      
      // Gerar Ordem
      'order_generation_pending': 'order_generation',
      'order_generation_processing': 'order_generation',
      
      // Almox Geral
      'almox_general_pending': 'almox_general',
      'almox_general_received': 'almox_general',
      'almox_general_processing': 'almox_general',
      
      // Produção
      'in_production': 'production',
      
      // Gerar Saldo
      'balance_calculation': 'balance_generation',
      
      // Laboratório
      'ready_for_laboratory': 'laboratory',
      'in_laboratory': 'laboratory',
      
      // Embalagem
      'ready_for_packaging': 'packaging',
      'in_packaging': 'packaging',
      
      // Cotação de Frete
      'ready_for_freight_quote': 'freight_quote',
      'freight_quote_requested': 'freight_quote',
      
      // Faturamento
      'ready_to_invoice': 'invoicing',
      'invoice_requested': 'invoicing',
      'invoice_issued': 'invoicing',
      
      // Expedição/Logística
      'in_expedition': 'logistics',
      'ready_for_shipping': 'logistics',
      'in_transit': 'logistics',
      'delivered': 'logistics',
      'completed': 'logistics'
    };

    return statusPhaseMap[status] || 'almox_ssm';
  };

  const getPhaseInfo = (status: Order['status']): PhaseInfo | null => {
    const phaseKey = getPhaseFromStatus(status);
    
    console.log('🔍 [usePhaseInfo] getPhaseInfo chamado:', {
      status,
      phaseKey,
      phaseConfigsCount: phaseConfigs.length,
      phaseKeys: phaseConfigs.map(pc => pc.phase_key)
    });
    
    const phaseConfig = phaseConfigs.find(pc => pc.phase_key === phaseKey);
    
    if (!phaseConfig) {
      console.warn('⚠️ [usePhaseInfo] Nenhuma phase_config encontrada para:', {
        status,
        phaseKey,
        availablePhaseKeys: phaseConfigs.map(pc => pc.phase_key)
      });
      
      // Fallback: retornar info básica mesmo sem config
      return {
        displayName: phaseKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        responsibleRole: 'admin',
        responsibleUsers: []
      };
    }

    const responsibleUsers = usersByRole.get(phaseConfig.responsible_role) || [];

    console.log('✅ [usePhaseInfo] Phase info encontrada:', {
      displayName: phaseConfig.display_name,
      responsibleRole: phaseConfig.responsible_role,
      usersCount: responsibleUsers.length
    });

    return {
      displayName: phaseConfig.display_name,
      responsibleRole: phaseConfig.responsible_role,
      responsibleUsers
    };
  };

  return { getPhaseInfo, loading };
};
