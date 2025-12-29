import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { 
  TechnicianDispatch, 
  TechnicianDispatchItem, 
  DispatchMetrics,
  DispatchStatus 
} from '@/types/technicians';

interface DispatchFilters {
  status?: DispatchStatus | 'all';
  technician_id?: string;
  warehouse?: string;
  from_date?: string;
  to_date?: string;
}

export function useTechnicianDispatches(filters?: DispatchFilters) {
  const [dispatches, setDispatches] = useState<TechnicianDispatch[]>([]);
  const [metrics, setMetrics] = useState<DispatchMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();
  const { user } = useAuth();

  const fetchDispatches = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('technician_dispatches')
        .select(`
          *,
          technician:technicians(id, name, city, state, whatsapp),
          order:orders(id, order_number, customer_name, order_type)
        `)
        .eq('organization_id', organizationId)
        .order('dispatch_date', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.technician_id) {
        query = query.eq('technician_id', filters.technician_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const dispatchesWithItems = await Promise.all(
        (data || []).map(async (dispatch: any) => {
          const { data: items } = await supabase
            .from('technician_dispatch_items')
            .select('id, quantity_sent, quantity_returned, return_status')
            .eq('dispatch_id', dispatch.id);

          return {
            ...dispatch,
            items_count: items?.length || 0,
            items_pending: items?.filter(i => i.return_status === 'pending').length || 0,
          } as TechnicianDispatch;
        })
      );

      setDispatches(dispatchesWithItems);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      toast.error('Erro ao carregar envios');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters?.status, filters?.technician_id]);

  const fetchMetrics = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data: dispatchData } = await supabase
        .from('technician_dispatches')
        .select('id, status')
        .eq('organization_id', organizationId);

      const { data: returnRequests } = await supabase
        .from('return_requests')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      setMetrics({
        total_dispatches: dispatchData?.length || 0,
        total_items_sent: 0,
        total_items_pending: 0,
        total_items_returned: 0,
        overdue_dispatches: dispatchData?.filter(d => d.status === 'overdue').length || 0,
        pending_return_requests: returnRequests?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [organizationId]);

  const createDispatch = async (
    orderId: string,
    technicianId: string,
    originWarehouse: string,
    expectedReturnDate: string | null,
    items: Array<{
      order_item_id?: string;
      item_code: string;
      item_description: string;
      unit: string;
      quantity_sent: number;
    }>,
    notes?: string
  ) => {
    try {
      const { data: dispatch, error: dispatchError } = await supabase
        .from('technician_dispatches')
        .insert({
          organization_id: organizationId,
          order_id: orderId,
          technician_id: technicianId,
          origin_warehouse: originWarehouse,
          expected_return_date: expectedReturnDate,
          notes,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      const itemsToInsert = items.map(item => ({
        dispatch_id: dispatch.id,
        ...item,
      }));

      await supabase.from('technician_dispatch_items').insert(itemsToInsert as any);

      toast.success('Envio registrado com sucesso');
      await fetchDispatches();
      return dispatch;
    } catch (error) {
      console.error('Error creating dispatch:', error);
      toast.error('Erro ao registrar envio');
      throw error;
    }
  };

  const getDispatchItems = async (dispatchId: string): Promise<TechnicianDispatchItem[]> => {
    const { data } = await supabase
      .from('technician_dispatch_items')
      .select('*')
      .eq('dispatch_id', dispatchId)
      .order('item_code');

    return (data as TechnicianDispatchItem[]) || [];
  };

  useEffect(() => {
    fetchDispatches();
    fetchMetrics();
  }, [fetchDispatches, fetchMetrics]);

  return {
    dispatches,
    metrics,
    loading,
    fetchDispatches,
    fetchMetrics,
    createDispatch,
    getDispatchItems,
  };
}
