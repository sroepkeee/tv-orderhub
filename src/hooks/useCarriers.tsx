import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Carrier } from '@/types/carriers';

export const useCarriers = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadCarriers = async (state?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('carriers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (state) {
        query = query.contains('service_states', [state]);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCarriers((data || []) as unknown as Carrier[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar transportadoras',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createCarrier = async (carrierData: Omit<Carrier, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('carriers')
        .insert(carrierData as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Transportadora criada',
        description: 'Transportadora cadastrada com sucesso.',
      });

      await loadCarriers();
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar transportadora',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateCarrier = async (id: string, updates: Partial<Carrier>) => {
    try {
      const { error } = await supabase
        .from('carriers')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Transportadora atualizada',
        description: 'Dados atualizados com sucesso.',
      });

      await loadCarriers();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteCarrier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('carriers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Transportadora desativada',
        description: 'Transportadora foi desativada.',
      });

      await loadCarriers();
    } catch (error: any) {
      toast({
        title: 'Erro ao desativar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getCarriersByState = async (state: string) => {
    return loadCarriers(state);
  };

  useEffect(() => {
    loadCarriers();
  }, []);

  return {
    carriers,
    loading,
    loadCarriers,
    createCarrier,
    updateCarrier,
    deleteCarrier,
    getCarriersByState,
  };
};
