import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from './useOrganizationId';
import { toast } from 'sonner';
import type { 
  ReturnProcess, 
  ReturnProcessMotivo, 
  ReturnProcessStatus,
  ProcessChecklistItem,
  Divergencia,
  AccessBlock,
  ProcessShipping,
  ReturnAuditLog
} from '@/types/returnProcess';

interface UseReturnProcessesOptions {
  status?: ReturnProcessStatus | ReturnProcessStatus[];
  technicianId?: string;
}

export function useReturnProcesses(options: UseReturnProcessesOptions = {}) {
  const [processes, setProcesses] = useState<ReturnProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useOrganizationId();

  const fetchProcesses = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('return_processes') as any)
        .select(`
          *,
          technician:technicians(id, name, email, phone, specialty)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status);
        } else {
          query = query.eq('status', options.status);
        }
      }

      if (options.technicianId) {
        query = query.eq('technician_id', options.technicianId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setProcesses((data as unknown as ReturnProcess[]) || []);
    } catch (error) {
      console.error('Error fetching return processes:', error);
      toast.error('Erro ao carregar processos de devolução');
    } finally {
      setLoading(false);
    }
  }, [organizationId, options.status, options.technicianId]);

  const createProcess = useCallback(async (
    technicianId: string,
    motivo: ReturnProcessMotivo,
    motivoDetalhes?: string,
    notes?: string
  ) => {
    if (!organizationId) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('return_processes') as any)
        .insert({
          organization_id: organizationId,
          technician_id: technicianId,
          motivo,
          motivo_detalhes: motivoDetalhes,
          notes,
          opened_by: userData.user?.id,
          status: 'aberto'
        })
        .select()
        .single();

      if (error) throw error;

      // Criar itens do checklist a partir do template padrão
      await initializeChecklistFromTemplate(data.id);

      // Criar registros de bloqueio de acessos
      await initializeAccessBlocks(data.id, technicianId);

      // Registrar no audit log
      await logAuditAction(data.id, 'process_created', 'process', data.id, null, data);

      toast.success('Processo de devolução criado com sucesso');
      await fetchProcesses();
      return data;
    } catch (error) {
      console.error('Error creating return process:', error);
      toast.error('Erro ao criar processo de devolução');
      return null;
    }
  }, [organizationId, fetchProcesses]);

  const updateProcessStatus = useCallback(async (
    processId: string,
    newStatus: ReturnProcessStatus,
    notes?: string
  ) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = supabase.from('return_processes') as any;
      
      const { data: oldData } = await table
        .select('*')
        .eq('id', processId)
        .single();

      const updates: Partial<ReturnProcess> = { status: newStatus };
      
      if (newStatus === 'finalizado' || newStatus === 'cancelado') {
        const { data: userData } = await supabase.auth.getUser();
        updates.closed_by = userData.user?.id;
        updates.closed_at = new Date().toISOString();
      }

      if (notes) {
        updates.notes = notes;
      }

      const { error } = await table
        .update(updates)
        .eq('id', processId);

      if (error) throw error;

      await logAuditAction(processId, 'status_changed', 'process', processId, oldData, { ...oldData, ...updates });

      toast.success('Status atualizado com sucesso');
      await fetchProcesses();
    } catch (error) {
      console.error('Error updating process status:', error);
      toast.error('Erro ao atualizar status');
    }
  }, [fetchProcesses]);

  const initializeChecklistFromTemplate = async (processId: string) => {
    try {
      // Buscar template padrão
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template } = await (supabase.from('checklist_templates') as any)
        .select('id')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (!template) return;

      // Buscar itens do template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: templateItems } = await (supabase.from('checklist_template_items') as any)
        .select('*')
        .eq('template_id', template.id)
        .order('sort_order');

      if (!templateItems || templateItems.length === 0) return;

      // Criar itens do checklist para o processo
      const checklistItems = templateItems.map((item: { id: string; name: string; category: string }) => ({
        process_id: processId,
        template_item_id: item.id,
        item_name: item.name,
        category: item.category,
        status: 'pendente'
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('process_checklist_items')
        .insert(checklistItems);
    } catch (error) {
      console.error('Error initializing checklist:', error);
    }
  };

  const initializeAccessBlocks = async (processId: string, technicianId: string) => {
    if (!organizationId) return;
    
    try {
      const accessTypes = ['email', 'paytrack', 'desk_manager', 'sistema_interno'];
      
      const accessBlocks = accessTypes.map(type => ({
        organization_id: organizationId,
        process_id: processId,
        technician_id: technicianId,
        access_type: type,
        status: 'pendente'
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('access_blocks') as any)
        .insert(accessBlocks);
    } catch (error) {
      console.error('Error initializing access blocks:', error);
    }
  };

  const logAuditAction = async (
    processId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('return_audit_log') as any)
        .insert({
          organization_id: organizationId,
          process_id: processId,
          user_id: userData.user?.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_value: oldValue,
          new_value: newValue
        });
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('return_processes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'return_processes',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchProcesses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, fetchProcesses]);

  return {
    processes,
    loading,
    fetchProcesses,
    createProcess,
    updateProcessStatus,
    logAuditAction
  };
}

// Hook para itens do checklist de um processo
export function useProcessChecklist(processId: string | null) {
  const [items, setItems] = useState<ProcessChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('process_checklist_items') as any)
        .select('*')
        .eq('process_id', processId)
        .order('category')
        .order('item_name');

      if (error) throw error;
      setItems((data as ProcessChecklistItem[]) || []);
    } catch (error) {
      console.error('Error fetching checklist items:', error);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<ProcessChecklistItem>
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('process_checklist_items') as any)
        .update({
          ...updates,
          verified_by: userData.user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;
      await fetchItems();
      return true;
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Erro ao atualizar item');
      return false;
    }
  }, [fetchItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, fetchItems, updateItem };
}

// Hook para divergências
export function useDivergencias(processId: string | null) {
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [loading, setLoading] = useState(false);
  const { organizationId } = useOrganizationId();

  const fetchDivergencias = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('divergencias')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDivergencias((data as Divergencia[]) || []);
    } catch (error) {
      console.error('Error fetching divergencias:', error);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  const createDivergencia = useCallback(async (
    data: Omit<Divergencia, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('divergencias')
        .insert({
          ...data,
          organization_id: organizationId,
          created_by: userData.user?.id
        });

      if (error) throw error;
      toast.success('Divergência registrada');
      await fetchDivergencias();
      return true;
    } catch (error) {
      console.error('Error creating divergencia:', error);
      toast.error('Erro ao registrar divergência');
      return false;
    }
  }, [organizationId, fetchDivergencias]);

  const updateDivergencia = useCallback(async (
    id: string,
    updates: Partial<Divergencia>
  ) => {
    try {
      const { error } = await supabase
        .from('divergencias')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchDivergencias();
      return true;
    } catch (error) {
      console.error('Error updating divergencia:', error);
      toast.error('Erro ao atualizar divergência');
      return false;
    }
  }, [fetchDivergencias]);

  useEffect(() => {
    fetchDivergencias();
  }, [fetchDivergencias]);

  return { divergencias, loading, fetchDivergencias, createDivergencia, updateDivergencia };
}

// Hook para bloqueios de acesso
export function useAccessBlocks(processId: string | null) {
  const [blocks, setBlocks] = useState<AccessBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBlocks = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_blocks')
        .select('*')
        .eq('process_id', processId)
        .order('access_type');

      if (error) throw error;
      setBlocks((data as AccessBlock[]) || []);
    } catch (error) {
      console.error('Error fetching access blocks:', error);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  const updateBlock = useCallback(async (
    blockId: string,
    status: 'bloqueado' | 'erro' | 'nao_aplicavel',
    evidenceUrl?: string,
    notes?: string
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('access_blocks')
        .update({
          status,
          evidence_url: evidenceUrl,
          notes,
          blocked_by: status === 'bloqueado' ? userData.user?.id : null,
          blocked_at: status === 'bloqueado' ? new Date().toISOString() : null
        })
        .eq('id', blockId);

      if (error) throw error;
      toast.success('Bloqueio atualizado');
      await fetchBlocks();
      return true;
    } catch (error) {
      console.error('Error updating access block:', error);
      toast.error('Erro ao atualizar bloqueio');
      return false;
    }
  }, [fetchBlocks]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { blocks, loading, fetchBlocks, updateBlock };
}

// Hook para shipping
export function useProcessShipping(processId: string | null) {
  const [shipping, setShipping] = useState<ProcessShipping | null>(null);
  const [loading, setLoading] = useState(false);
  const { organizationId } = useOrganizationId();

  const fetchShipping = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('process_shipping')
        .select('*')
        .eq('process_id', processId)
        .maybeSingle();

      if (error) throw error;
      setShipping(data as ProcessShipping | null);
    } catch (error) {
      console.error('Error fetching shipping:', error);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  const createOrUpdateShipping = useCallback(async (
    data: Partial<ProcessShipping>
  ) => {
    if (!processId) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = supabase.from('process_shipping') as any;
      
      if (shipping) {
        const { error } = await table.update(data).eq('id', shipping.id);
        if (error) throw error;
      } else {
        const { error } = await table.insert({
          ...data,
          organization_id: organizationId,
          process_id: processId
        });
        if (error) throw error;
      }

      await fetchShipping();
      return true;
    } catch (error) {
      console.error('Error saving shipping:', error);
      toast.error('Erro ao salvar dados de envio');
      return false;
    }
  }, [processId, shipping, organizationId, fetchShipping]);

  useEffect(() => {
    fetchShipping();
  }, [fetchShipping]);

  return { shipping, loading, fetchShipping, createOrUpdateShipping };
}

// Hook para audit log
export function useReturnAuditLog(processId: string | null) {
  const [logs, setLogs] = useState<ReturnAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('return_audit_log')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs((data as ReturnAuditLog[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, fetchLogs };
}
