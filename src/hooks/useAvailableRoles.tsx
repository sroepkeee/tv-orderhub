import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS } from '@/lib/roleLabels';

export interface RoleOption {
  value: string;
  label: string;
  area: string;
}

export const useAvailableRoles = () => {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      // Buscar enum values diretamente do banco
      const { data, error } = await supabase.rpc('get_app_roles');
      
      if (error) throw error;

      // Filtrar apenas roles válidos (fases atuais + admin)
      const validRoles = [
        'admin',
        'almox_ssm',
        'order_generation',
        'almox_general',
        'production_client',
        'production_stock',
        'purchases',
        'balance_generation',
        'laboratory',
        'packaging',
        'freight_quote',
        'ready_to_invoice',
        'invoicing',
        'logistics',
        'in_transit',
        'completion'
      ];

      const roleOptions: RoleOption[] = data
        .filter((r: { role: string }) => validRoles.includes(r.role))
        .map((r: { role: string }) => ({
          value: r.role,
          label: ROLE_LABELS[r.role]?.name || r.role,
          area: ROLE_LABELS[r.role]?.area || 'Outros'
        }));

      setRoles(roleOptions);
    } catch (error) {
      console.error('Erro ao carregar roles:', error);
    } finally {
      setLoading(false);
    }
  };

  return { roles, loading };
};
