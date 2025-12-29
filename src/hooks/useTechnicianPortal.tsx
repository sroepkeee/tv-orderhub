import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Technician, TechnicianDispatch } from '@/types/technicians';

export function useTechnicianPortal() {
  const { user } = useAuth();
  const [technicianInfo, setTechnicianInfo] = useState<Technician | null>(null);
  const [pendingItems, setPendingItems] = useState<TechnicianDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTechnicianInfo = useCallback(async () => {
    if (!user?.id) return null;

    try {
      // Buscar técnico vinculado ao usuário
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      setTechnicianInfo(data as Technician | null);
      return data;
    } catch (error) {
      console.error('Error fetching technician info:', error);
      return null;
    }
  }, [user?.id]);

  const fetchPendingItems = useCallback(async () => {
    if (!technicianInfo?.id) return;

    setLoading(true);
    try {
      // Buscar dispatches com itens pendentes
      const { data: dispatches, error } = await supabase
        .from('technician_dispatches')
        .select(`
          *,
          order:orders(id, order_number, customer_name),
          technician:technicians(id, name)
        `)
        .eq('technician_id', technicianInfo.id)
        .in('status', ['dispatched', 'partial_return'])
        .order('dispatch_date', { ascending: false });

      if (error) throw error;

      // Buscar itens para cada dispatch
      const dispatchesWithItems = await Promise.all(
        (dispatches || []).map(async (dispatch) => {
          const { data: items } = await supabase
            .from('technician_dispatch_items')
            .select('*')
            .eq('dispatch_id', dispatch.id)
            .in('return_status', ['pending', 'partial']);

          const itemsPending = items?.reduce((acc, item) => 
            acc + (item.quantity_sent - item.quantity_returned), 0
          ) || 0;

          return {
            ...dispatch,
            items: items || [],
            items_count: items?.length || 0,
            items_pending: itemsPending,
          };
        })
      );

      setPendingItems(dispatchesWithItems as TechnicianDispatch[]);
    } catch (error) {
      console.error('Error fetching pending items:', error);
      toast.error('Erro ao carregar itens pendentes');
    } finally {
      setLoading(false);
    }
  }, [technicianInfo?.id]);

  const searchItemsByCode = useCallback(async (itemCode: string) => {
    if (!technicianInfo?.id) return [];

    try {
      const { data, error } = await supabase
        .from('technician_dispatch_items')
        .select(`
          *,
          dispatch:technician_dispatches!inner(
            id,
            technician_id,
            dispatch_date,
            origin_warehouse,
            order:orders(order_number)
          )
        `)
        .ilike('item_code', `%${itemCode}%`)
        .eq('dispatch.technician_id', technicianInfo.id)
        .in('return_status', ['pending', 'partial']);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching items:', error);
      return [];
    }
  }, [technicianInfo?.id]);

  useEffect(() => {
    fetchTechnicianInfo().then((tech) => {
      if (tech) {
        fetchPendingItems();
      } else {
        setLoading(false);
      }
    });
  }, [fetchTechnicianInfo]);

  useEffect(() => {
    if (technicianInfo?.id) {
      fetchPendingItems();
    }
  }, [technicianInfo?.id, fetchPendingItems]);

  return {
    technicianInfo,
    pendingItems,
    loading,
    fetchTechnicianInfo,
    fetchPendingItems,
    searchItemsByCode,
  };
}
