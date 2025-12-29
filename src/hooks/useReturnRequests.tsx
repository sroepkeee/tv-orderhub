import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { ReturnRequest, ReturnRequestStatus } from '@/types/technicians';

interface ReturnRequestFilters {
  status?: ReturnRequestStatus | 'all';
  technician_id?: string;
}

export function useReturnRequests(filters?: ReturnRequestFilters) {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();
  const { user } = useAuth();

  const fetchRequests = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('return_requests')
        .select(`
          *,
          technician:technicians(id, name, city, state, whatsapp),
          dispatch:technician_dispatches(id, order_id, origin_warehouse, dispatch_date),
          carrier:carriers(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('requested_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests((data as ReturnRequest[]) || []);
    } catch (error) {
      console.error('Error fetching return requests:', error);
      toast.error('Erro ao carregar solicitações de retorno');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters?.status]);

  const createReturnRequest = async (
    dispatchId: string,
    technicianId: string,
    destinationWarehouse: string,
    items: Array<{ dispatch_item_id: string; quantity_returning: number; condition: string }>,
    notes?: string
  ) => {
    try {
      const { data: request, error } = await supabase
        .from('return_requests')
        .insert({
          organization_id: organizationId,
          dispatch_id: dispatchId,
          technician_id: technicianId,
          destination_warehouse: destinationWarehouse,
          notes,
          requested_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const itemsToInsert = items.map(item => ({
        return_request_id: request.id,
        ...item,
      }));

      await supabase.from('return_request_items').insert(itemsToInsert as any);

      toast.success('Solicitação de retorno criada');
      await fetchRequests();
      return request;
    } catch (error) {
      console.error('Error creating return request:', error);
      toast.error('Erro ao criar solicitação');
      throw error;
    }
  };

  const approveRequest = async (id: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() } as any)
        .eq('id', id);

      toast.success('Solicitação aprovada');
      await fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Erro ao aprovar solicitação');
    }
  };

  const confirmReceipt = async (id: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ status: 'received', received_by: user?.id, received_at: new Date().toISOString() } as any)
        .eq('id', id);

      toast.success('Recebimento confirmado');
      await fetchRequests();
    } catch (error) {
      console.error('Error confirming receipt:', error);
      toast.error('Erro ao confirmar recebimento');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    fetchRequests,
    createReturnRequest,
    approveRequest,
    confirmReceipt,
  };
}
