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

      const roleOptions: RoleOption[] = data.map((r: { role: string }) => ({
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
