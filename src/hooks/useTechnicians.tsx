import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { toast } from 'sonner';
import type { Technician } from '@/types/technicians';

export function useTechnicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();

  const fetchTechnicians = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTechnicians((data as Technician[]) || []);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      toast.error('Erro ao carregar técnicos');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const createTechnician = async (technician: Partial<Technician>) => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .insert({
          ...technician,
          organization_id: organizationId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success('Técnico cadastrado com sucesso');
      await fetchTechnicians();
      return data as Technician;
    } catch (error) {
      console.error('Error creating technician:', error);
      toast.error('Erro ao cadastrar técnico');
      throw error;
    }
  };

  const updateTechnician = async (id: string, updates: Partial<Technician>) => {
    try {
      const { error } = await supabase
        .from('technicians')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Técnico atualizado com sucesso');
      await fetchTechnicians();
    } catch (error) {
      console.error('Error updating technician:', error);
      toast.error('Erro ao atualizar técnico');
      throw error;
    }
  };

  const deleteTechnician = async (id: string) => {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Técnico removido com sucesso');
      await fetchTechnicians();
    } catch (error) {
      console.error('Error deleting technician:', error);
      toast.error('Erro ao remover técnico');
      throw error;
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  return {
    technicians,
    loading,
    fetchTechnicians,
    createTechnician,
    updateTechnician,
    deleteTechnician,
  };
}
