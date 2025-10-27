import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { OrderVolume, VolumeTotals } from '@/types/volumes';

export function useOrderVolumes(orderId: string) {
  const [volumes, setVolumes] = useState<OrderVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const calculateTotals = useCallback((): VolumeTotals => {
    const total_volumes = volumes.reduce((sum, vol) => sum + vol.quantity, 0);
    const total_weight_kg = volumes.reduce((sum, vol) => sum + (vol.weight_kg * vol.quantity), 0);
    const total_cubagem_m3 = volumes.reduce((sum, vol) => {
      const cubagem = (vol.length_cm * vol.width_cm * vol.height_cm) / 1000000;
      return sum + (cubagem * vol.quantity);
    }, 0);

    return {
      total_volumes,
      total_weight_kg,
      total_cubagem_m3
    };
  }, [volumes]);

  const updateOrderSummary = useCallback(async () => {
    try {
      const totals = calculateTotals();
      
      // Pegar dimensões do primeiro volume
      const firstVolume = volumes[0];
      
      await supabase
        .from('orders')
        .update({
          package_volumes: totals.total_volumes,
          package_weight_kg: totals.total_weight_kg,
          package_length_m: firstVolume ? firstVolume.length_cm / 100 : null,
          package_width_m: firstVolume ? firstVolume.width_cm / 100 : null,
          package_height_m: firstVolume ? firstVolume.height_cm / 100 : null,
        })
        .eq('id', orderId);
      
      console.log('✅ Resumo do pedido atualizado automaticamente');
    } catch (error) {
      console.error('❌ Erro ao atualizar resumo do pedido:', error);
    }
  }, [orderId, volumes, calculateTotals]);

  const loadVolumes = useCallback(async () => {
    if (!orderId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_volumes')
        .select('*')
        .eq('order_id', orderId)
        .order('volume_number', { ascending: true });

      if (error) throw error;
      setVolumes(data || []);
    } catch (error: any) {
      console.error('Error loading volumes:', error);
      toast({
        title: 'Erro ao carregar volumes',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [orderId, toast]);

  const saveVolume = useCallback(async (volume: Partial<OrderVolume>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const volumeData = {
        ...volume,
        order_id: orderId,
        created_by: user.id
      };

      if (volume.id) {
        // Update existing
        const { error } = await supabase
          .from('order_volumes')
          .update(volumeData)
          .eq('id', volume.id);

        if (error) throw error;

        // Log change
        await supabase.from('order_changes').insert({
          order_id: orderId,
          field_name: 'volume_updated',
          old_value: '',
          new_value: `Volume ${volume.volume_number} atualizado`,
          changed_by: user.id,
          change_category: 'volumes'
        });

        toast({
          title: 'Volume atualizado',
          description: 'As alterações foram salvas com sucesso.'
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('order_volumes')
          .insert([volumeData as any]);

        if (error) throw error;

        // Log change
        const packagingLabel = volume.packaging_type ? ` - ${volume.packaging_type}` : '';
        await supabase.from('order_changes').insert({
          order_id: orderId,
          field_name: 'volume_added',
          old_value: '',
          new_value: `Adicionou volume ${volume.volume_number}: ${volume.quantity}x ${volume.weight_kg}kg (${volume.length_cm}x${volume.width_cm}x${volume.height_cm}cm)${packagingLabel}`,
          changed_by: user.id,
          change_category: 'volumes'
        });

        toast({
          title: 'Volume adicionado',
          description: 'O volume foi adicionado com sucesso.'
        });
      }

      await loadVolumes();
      await updateOrderSummary();
      return true;
    } catch (error: any) {
      console.error('Error saving volume:', error);
      toast({
        title: 'Erro ao salvar volume',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, [orderId, loadVolumes, updateOrderSummary, toast]);

  const deleteVolume = useCallback(async (volumeId: string, volumeNumber: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('order_volumes')
        .delete()
        .eq('id', volumeId);

      if (error) throw error;

      // Log change
      await supabase.from('order_changes').insert({
        order_id: orderId,
        field_name: 'volume_removed',
        old_value: `Volume ${volumeNumber}`,
        new_value: '',
        changed_by: user.id,
        change_category: 'volumes'
      });

      toast({
        title: 'Volume removido',
        description: 'O volume foi excluído com sucesso.'
      });

      await loadVolumes();
      await updateOrderSummary();
    } catch (error: any) {
      console.error('Error deleting volume:', error);
      toast({
        title: 'Erro ao remover volume',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [orderId, loadVolumes, updateOrderSummary, toast]);

  return {
    volumes,
    loading,
    loadVolumes,
    saveVolume,
    deleteVolume,
    totals: calculateTotals()
  };
}
