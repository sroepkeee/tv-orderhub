import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
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

interface PhaseData {
  phaseConfigs: PhaseConfig[];
  usersByRole: Record<string, UserProfile[]>;
}

const fetchPhaseData = async (): Promise<PhaseData> => {
  // 🚀 Queries em paralelo (antes eram sequenciais)
  const [phaseRes, rolesRes, profilesRes] = await Promise.all([
    supabase.from('phase_config').select('phase_key, display_name, responsible_role').order('order_index'),
    supabase.from('user_roles').select('role, user_id'),
    supabase.from('profiles').select('id, full_name, email'),
  ]);

  if (phaseRes.error) throw phaseRes.error;
  if (rolesRes.error) throw rolesRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const profilesById = new Map<string, UserProfile>();
  profilesRes.data?.forEach(p => {
    if (!p) return;
    profilesById.set(p.id, { id: p.id, full_name: p.full_name || p.email || 'Usuário', email: p.email });
  });

  const roleMap: Record<string, UserProfile[]> = {};
  rolesRes.data?.forEach(ur => {
    const profile = profilesById.get(ur.user_id);
    if (profile) {
      if (!roleMap[ur.role]) roleMap[ur.role] = [];
      roleMap[ur.role].push(profile);
    }
  });

  return { phaseConfigs: phaseRes.data || [], usersByRole: roleMap };
};

export const usePhaseInfo = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['phase-info-data'],
    queryFn: fetchPhaseData,
    staleTime: 5 * 60_000,  // 5 min - dados mudam raramente
    gcTime: 10 * 60_000,    // 10 min no cache
    refetchOnWindowFocus: false,
  });

  const phaseConfigs = data?.phaseConfigs || [];
  const usersByRole = data?.usersByRole || {};

  const getPhaseFromStatus = useCallback((status: Order['status']): string => {
    const statusPhaseMap: Record<string, string> = {
      'almox_ssm_pending': 'almox_ssm',
      'almox_ssm_received': 'almox_ssm',
      'almox_ssm_processing': 'almox_ssm',
      'order_generation_pending': 'order_generation',
      'order_generation_processing': 'order_generation',
      'almox_general_pending': 'almox_general',
      'almox_general_received': 'almox_general',
      'almox_general_processing': 'almox_general',
      'in_production': 'production_client',
      'separation_started': 'production_client',
      'awaiting_material': 'production_client',
      'separation_completed': 'production_client',
      'production_completed': 'production_client',
      'balance_calculation': 'balance_generation',
      'ready_for_laboratory': 'laboratory',
      'in_laboratory': 'laboratory',
      'ready_for_packaging': 'packaging',
      'in_packaging': 'packaging',
      'ready_for_freight_quote': 'freight_quote',
      'freight_quote_requested': 'freight_quote',
      'ready_to_invoice': 'ready_to_invoice',
      'pending_invoice_request': 'ready_to_invoice',
      'invoice_requested': 'invoicing',
      'awaiting_invoice': 'invoicing',
      'invoice_issued': 'invoicing',
      'invoice_sent': 'invoicing',
      'in_expedition': 'logistics',
      'ready_for_shipping': 'logistics',
      'in_transit': 'logistics',
      'delivered': 'completion',
      'completed': 'completion',
      'cancelled': 'completion',
      'delayed': 'completion',
      'returned': 'completion',
      'pending': 'completion',
      'in_analysis': 'completion',
      'awaiting_approval': 'completion',
      'planned': 'completion',
      'on_hold': 'completion'
    };
    return statusPhaseMap[status] || 'almox_ssm';
  }, []);

  const getPhaseInfo = useCallback((status: Order['status']): PhaseInfo | null => {
    const phaseKey = getPhaseFromStatus(status);
    const phaseConfig = phaseConfigs.find(pc => pc.phase_key === phaseKey);

    if (!phaseConfig) {
      return {
        displayName: phaseKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        responsibleRole: 'admin',
        responsibleUsers: []
      };
    }

    const responsibleUsers = usersByRole[phaseConfig.responsible_role] || [];

    return {
      displayName: phaseConfig.display_name,
      responsibleRole: phaseConfig.responsible_role,
      responsibleUsers
    };
  }, [phaseConfigs, usersByRole, getPhaseFromStatus]);

  return { getPhaseInfo, loading: isLoading };
};
