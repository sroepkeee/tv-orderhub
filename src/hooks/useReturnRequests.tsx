import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { ReturnRequest, ReturnRequestStatus, VolumeDetail, DestinationType } from '@/types/technicians';

interface ReturnRequestFilters {
  status?: ReturnRequestStatus | 'all';
  technician_id?: string;
  destination_type?: DestinationType | 'all';
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
          technician:technicians!return_requests_technician_id_fkey(id, name, city, state, whatsapp),
          dispatch:technician_dispatches(id, order_id, origin_warehouse, dispatch_date),
          carrier:carriers(id, name),
          destination_technician:technicians!return_requests_destination_technician_id_fkey(id, name, city, state)
        `)
        .eq('organization_id', organizationId)
        .order('requested_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.destination_type && filters.destination_type !== 'all') {
        query = query.eq('destination_type', filters.destination_type);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests((data || []) as unknown as ReturnRequest[]);
    } catch (error) {
      console.error('Error fetching return requests:', error);
      toast.error('Erro ao carregar solicitações de retorno');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters?.status, filters?.destination_type]);

  const createReturnRequest = async (params: {
    dispatchId: string;
    technicianId: string;
    destinationWarehouse: string;
    destinationType?: DestinationType;
    destinationTechnicianId?: string;
    items: Array<{ dispatch_item_id: string; quantity_returning: number; condition: string; notes?: string }>;
    pickupAddress?: string;
    pickupCity?: string;
    pickupState?: string;
    pickupZipCode?: string;
    pickupContact?: string;
    pickupPhone?: string;
    totalWeightKg?: number;
    totalVolumes?: number;
    volumeDetails?: VolumeDetail[];
    photoUrls?: string[];
    notes?: string;
  }) => {
    try {
      const { data: request, error } = await supabase
        .from('return_requests')
        .insert({
          organization_id: organizationId,
          dispatch_id: params.dispatchId,
          technician_id: params.technicianId,
          destination_warehouse: params.destinationWarehouse,
          destination_type: params.destinationType || 'warehouse',
          destination_technician_id: params.destinationTechnicianId,
          pickup_address: params.pickupAddress,
          pickup_city: params.pickupCity,
          pickup_state: params.pickupState,
          pickup_zip_code: params.pickupZipCode,
          pickup_contact: params.pickupContact,
          pickup_phone: params.pickupPhone,
          total_weight_kg: params.totalWeightKg,
          total_volumes: params.totalVolumes,
          volume_details: params.volumeDetails || [],
          photo_urls: params.photoUrls || [],
          notes: params.notes,
          requested_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (params.items.length > 0) {
        const itemsToInsert = params.items.map(item => ({
          return_request_id: request.id,
          ...item,
        }));

        await supabase.from('return_request_items').insert(itemsToInsert as any);
      }

      toast.success(
        params.destinationType === 'technician' 
          ? 'Solicitação de transferência criada' 
          : 'Solicitação de retorno criada'
      );
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
        .update({ 
          status: 'approved', 
          approved_by: user?.id, 
          approved_at: new Date().toISOString() 
        } as any)
        .eq('id', id);

      toast.success('Solicitação aprovada');
      await fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Erro ao aprovar solicitação');
    }
  };

  const rejectRequest = async (id: string, reason: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ 
          status: 'rejected', 
          rejection_reason: reason,
          approved_by: user?.id, 
          approved_at: new Date().toISOString() 
        } as any)
        .eq('id', id);

      toast.success('Solicitação rejeitada');
      await fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erro ao rejeitar solicitação');
    }
  };

  const schedulePickup = async (id: string, scheduledDate: string, carrierId?: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ 
          status: 'scheduled',
          scheduled_pickup_date: scheduledDate,
          carrier_id: carrierId,
        } as any)
        .eq('id', id);

      toast.success('Coleta agendada');
      await fetchRequests();
    } catch (error) {
      console.error('Error scheduling pickup:', error);
      toast.error('Erro ao agendar coleta');
    }
  };

  const updateTracking = async (id: string, trackingCode: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ 
          status: 'in_transit',
          tracking_code: trackingCode,
        } as any)
        .eq('id', id);

      toast.success('Tracking atualizado');
      await fetchRequests();
    } catch (error) {
      console.error('Error updating tracking:', error);
      toast.error('Erro ao atualizar tracking');
    }
  };

  const confirmReceipt = async (id: string) => {
    try {
      await supabase
        .from('return_requests')
        .update({ 
          status: 'received', 
          received_by: user?.id, 
          received_at: new Date().toISOString() 
        } as any)
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
    rejectRequest,
    schedulePickup,
    updateTracking,
    confirmReceipt,
  };
}
