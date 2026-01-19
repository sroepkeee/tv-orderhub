import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { toast } from 'sonner';
import type { ReturnTicket, ReturnTicketItem } from '@/types/technicians';

interface ReturnTicketFilters {
  status?: string;
  technicianId?: string;
  startDate?: string;
  endDate?: string;
}

export function useReturnTickets(filters?: ReturnTicketFilters) {
  const [tickets, setTickets] = useState<ReturnTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();

  const fetchTickets = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('return_tickets')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.technicianId) {
        query = query.eq('technician_id', filters.technicianId);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Parse items from JSONB
      const parsedTickets = (data || []).map(ticket => ({
        ...ticket,
        items: (ticket.items as unknown as ReturnTicketItem[]) || [],
      })) as ReturnTicket[];
      
      setTickets(parsedTickets);
    } catch (error) {
      console.error('Error fetching return tickets:', error);
      toast.error('Erro ao carregar tickets de retorno');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters?.status, filters?.technicianId, filters?.startDate, filters?.endDate]);

  const generateTicketNumber = useCallback(async (): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generate_return_ticket_number');
      if (error) throw error;
      return data as string;
    } catch (error) {
      console.error('Error generating ticket number:', error);
      // Fallback: generate locally
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
      return `RET-${year}-${random}`;
    }
  }, []);

  const createTicket = useCallback(async (
    ticketData: Omit<ReturnTicket, 'id' | 'ticket_number' | 'created_at' | 'status'>
  ): Promise<ReturnTicket | null> => {
    if (!organizationId) return null;
    
    try {
      const ticketNumber = await generateTicketNumber();
      
      const { data, error } = await supabase
        .from('return_tickets')
        .insert({
          ...ticketData,
          ticket_number: ticketNumber,
          organization_id: organizationId,
          status: 'pending',
          items: ticketData.items as any,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newTicket = {
        ...data,
        items: (data.items as unknown as ReturnTicketItem[]) || [],
      } as ReturnTicket;
      
      await fetchTickets();
      return newTicket;
    } catch (error) {
      console.error('Error creating return ticket:', error);
      toast.error('Erro ao criar ticket de retorno');
      return null;
    }
  }, [organizationId, generateTicketNumber, fetchTickets]);

  const updateTicketStatus = useCallback(async (
    ticketId: string,
    status: 'pending' | 'processed' | 'cancelled',
    totvs_return_number?: string
  ) => {
    try {
      const updates: any = { status };
      
      if (status === 'processed') {
        updates.processed_at = new Date().toISOString();
        if (totvs_return_number) {
          updates.totvs_return_number = totvs_return_number;
        }
      }

      const { error } = await supabase
        .from('return_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;
      
      toast.success(
        status === 'processed' 
          ? 'Ticket marcado como processado' 
          : status === 'cancelled' 
            ? 'Ticket cancelado'
            : 'Status atualizado'
      );
      await fetchTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error('Erro ao atualizar status do ticket');
    }
  }, [fetchTickets]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    fetchTickets,
    createTicket,
    updateTicketStatus,
    generateTicketNumber,
  };
}
