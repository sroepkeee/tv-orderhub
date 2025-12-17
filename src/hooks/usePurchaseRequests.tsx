import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseRequest, PurchaseRequestItem, PurchaseMetrics } from '@/types/purchases';
import { toast } from 'sonner';

export const usePurchaseRequests = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PurchaseMetrics>({
    total_active_requests: 0,
    items_awaiting_request: 0,
    pending_approvals: 0,
    approved_this_month: 0,
    total_estimated_value: 0,
  });

  useEffect(() => {
    loadRequests();
    loadMetrics();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          profiles:requested_by(full_name, email),
          approver:approved_by(full_name)
        `)
        .in('status', ['draft', 'pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as PurchaseRequest[]);
    } catch (error) {
      console.error('Error loading purchase requests:', error);
      toast.error('Erro ao carregar solicitações de compra');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      // Total de solicitações ativas
      const { count: activeCount } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'pending', 'approved']);

      // Itens aguardando solicitação
      const { count: awaitingCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('item_status', 'purchase_required');

      // Solicitações pendentes de aprovação
      const { count: pendingCount } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Aprovadas este mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: approvedCount } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('approved_at', startOfMonth.toISOString());

      // Valor total estimado
      const { data: valueData } = await supabase
        .from('purchase_requests')
        .select('total_estimated_value')
        .in('status', ['draft', 'pending', 'approved']);

      const totalValue = valueData?.reduce((sum, req) => sum + (req.total_estimated_value || 0), 0) || 0;

      setMetrics({
        total_active_requests: activeCount || 0,
        items_awaiting_request: awaitingCount || 0,
        pending_approvals: pendingCount || 0,
        approved_this_month: approvedCount || 0,
        total_estimated_value: totalValue,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const sendPurchaseNotification = async (
    requestId: string,
    items: any[],
    requestData: Partial<PurchaseRequest>
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.user?.id)
        .single();

      const payload = {
        purchaseRequestId: requestId,
        orderNumber: requestData.purchase_order_number || 'N/A',
        customerName: requestData.company || 'Solicitação de Compra',
        deliveryDate: requestData.expected_delivery_date || new Date().toISOString(),
        items: items.map(item => ({
          itemCode: item.item_code,
          itemDescription: item.item_description,
          requestedQuantity: item.requested_quantity,
          unit: item.unit,
          warehouse: item.warehouse
        })),
        movedBy: profile?.full_name || 'Sistema',
        notes: requestData.notes
      };

      const { data, error } = await supabase.functions.invoke('notify-purchases', {
        body: payload
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  };

  const createAutomaticRequest = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Buscar itens com purchase_required
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*, orders(order_number, customer_name)')
        .eq('item_status', 'purchase_required');

      if (itemsError) throw itemsError;

      if (!items || items.length === 0) {
        toast.info('Nenhum item aguardando solicitação de compra');
        return null;
      }

      // Gerar número da OC
      const { data: ocNumber } = await supabase.rpc('generate_purchase_order_number');
      
      // Criar solicitação
      const { data: request, error: requestError } = await supabase
        .from('purchase_requests')
        .insert({
          purchase_order_number: ocNumber,
          requested_by: user.user.id,
          request_type: 'normal',
          status: 'draft',
          notes: `Solicitação gerada automaticamente com ${items.length} itens`,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Criar itens da solicitação com dados enriquecidos
      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          // Buscar histórico de compras (últimas 3)
          const { data: history } = await supabase
            .from('item_purchase_history')
            .select('*')
            .eq('item_code', item.item_code)
            .order('purchase_date', { ascending: false })
            .limit(3);

          // Buscar métricas de consumo
          const { data: consumption } = await supabase
            .from('item_consumption_metrics')
            .select('*')
            .eq('item_code', item.item_code)
            .maybeSingle();

          // Buscar informações de estoque
          const { data: stock } = await supabase
            .from('item_stock_info')
            .select('*')
            .eq('item_code', item.item_code)
            .eq('warehouse', item.warehouse)
            .maybeSingle();

          return {
            purchase_request_id: request.id,
            order_item_id: item.id,
            item_code: item.item_code,
            item_description: item.item_description,
            requested_quantity: item.requested_quantity,
            unit: item.unit,
            unit_price: item.unit_price || stock?.last_purchase_price || 0,
            total_price: (item.unit_price || stock?.last_purchase_price || 0) * item.requested_quantity,
            warehouse: item.warehouse,
            item_status: 'pending',
            purchase_history: history || [],
            consumption_metrics: consumption,
            current_stock: stock?.current_stock_quantity || 0,
          };
        })
      );

      const { data: createdItems, error: itemsInsertError } = await supabase
        .from('purchase_request_items')
        .insert(enrichedItems.map(item => ({
          purchase_request_id: item.purchase_request_id,
          order_item_id: item.order_item_id,
          item_code: item.item_code,
          item_description: item.item_description,
          requested_quantity: item.requested_quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
          warehouse: item.warehouse,
          item_status: item.item_status,
        })))
        .select();

      if (itemsInsertError) throw itemsInsertError;

      toast.success(`Solicitação ${ocNumber} criada com ${items.length} itens. Configure empresa e rateios!`);
      await loadRequests();
      await loadMetrics();
      
      return {
        request,
        enrichedItems: createdItems?.map((item, index) => ({
          ...item,
          purchase_history: enrichedItems[index].purchase_history,
          consumption_metrics: enrichedItems[index].consumption_metrics,
          current_stock: enrichedItems[index].current_stock,
        }))
      };
    } catch (error) {
      console.error('Error creating automatic request:', error);
      toast.error('Erro ao criar solicitação automática');
      return null;
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'pending' | 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const updates: any = { status };
      
      if (status === 'approved') {
        updates.approved_by = user.user.id;
        updates.approved_at = new Date().toISOString();
      } else if (status === 'rejected' && rejectionReason) {
        updates.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('purchase_requests')
        .update(updates)
        .eq('id', requestId);

      if (error) throw error;

      // Se aprovado, atualizar status dos order_items relacionados
      if (status === 'approved') {
        const { data: items } = await supabase
          .from('purchase_request_items')
          .select('order_item_id')
          .eq('purchase_request_id', requestId)
          .not('order_item_id', 'is', null);

        if (items && items.length > 0) {
          const itemIds = items.map(item => item.order_item_id);
          await supabase
            .from('order_items')
            .update({ item_status: 'purchase_requested' })
            .in('id', itemIds);
        }
      }

      toast.success(`Solicitação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`);
      await loadRequests();
      await loadMetrics();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast.error('Erro ao atualizar status da solicitação');
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Solicitação excluída com sucesso');
      await loadRequests();
      await loadMetrics();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Erro ao excluir solicitação');
    }
  };

  const saveRequest = async (
    requestData: Partial<PurchaseRequest>,
    items: any[],
    costAllocations: { [itemId: string]: any[] },
    sendNotification: boolean = false
  ) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      let requestId = requestData.id;
      let purchaseOrderNumber = requestData.purchase_order_number;

      // Se não tem ID, criar nova solicitação
      if (!requestId) {
        const { data: ocNumber } = await supabase.rpc('generate_purchase_order_number');
        purchaseOrderNumber = ocNumber;
        
        const { data: request, error: requestError } = await supabase
          .from('purchase_requests')
          .insert({
            purchase_order_number: ocNumber,
            requested_by: user.user.id,
            company: requestData.company,
            request_type: requestData.request_type || 'normal',
            status: requestData.status || 'draft',
            notes: requestData.notes,
            expected_delivery_date: requestData.expected_delivery_date,
            total_estimated_value: requestData.total_estimated_value,
          })
          .select()
          .single();

        if (requestError) throw requestError;
        requestId = request.id;

        // Criar itens
        const requestItems = items.map(item => ({
          purchase_request_id: request.id,
          order_item_id: item.order_item_id,
          item_code: item.item_code,
          item_description: item.item_description,
          requested_quantity: item.requested_quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
          warehouse: item.warehouse,
          item_status: 'pending',
        }));

        const { data: createdItems, error: itemsError } = await supabase
          .from('purchase_request_items')
          .insert(requestItems)
          .select();

        if (itemsError) throw itemsError;

        // Criar cost allocations
        for (const createdItem of createdItems || []) {
          const originalItem = items.find(i => i.item_code === createdItem.item_code);
          if (originalItem && costAllocations[originalItem.id]) {
            const allocations = costAllocations[originalItem.id].map((alloc: any) => ({
              purchase_request_item_id: createdItem.id,
              business_unit: alloc.business_unit,
              accounting_item: alloc.accounting_item || null,
              cost_center: alloc.cost_center,
              warehouse: alloc.warehouse,
              project: alloc.project || null,
              allocation_percentage: alloc.allocation_percentage,
              allocated_quantity: alloc.allocated_quantity || null,
              allocated_value: alloc.allocated_value || null,
              notes: alloc.notes || null,
            }));

            await supabase
              .from('item_cost_allocation')
              .insert(allocations);
          }
        }
      } else {
        // Atualizar solicitação existente
        const { error: updateError } = await supabase
          .from('purchase_requests')
          .update({
            company: requestData.company,
            request_type: requestData.request_type,
            status: requestData.status,
            notes: requestData.notes,
            expected_delivery_date: requestData.expected_delivery_date,
            total_estimated_value: requestData.total_estimated_value,
          })
          .eq('id', requestId);

        if (updateError) throw updateError;
      }

      // Se status é 'pending' (enviando para aprovação), enviar notificação
      if (sendNotification && requestData.status === 'pending' && requestId) {
        try {
          await sendPurchaseNotification(requestId, items, {
            ...requestData,
            purchase_order_number: purchaseOrderNumber
          });
          toast.success('📧 E-mail enviado para Compras e SSM!');
        } catch (notifyError) {
          console.error('Error sending notification:', notifyError);
          toast.warning('Solicitação salva, mas erro ao enviar e-mail');
        }
      }

      await loadRequests();
      await loadMetrics();
      return requestId;
    } catch (error) {
      console.error('Error saving request:', error);
      throw error;
    }
  };

  const resendNotification = async (requestId: string) => {
    try {
      // Buscar dados da solicitação e itens
      const { data: request, error: requestError } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      const { data: items, error: itemsError } = await supabase
        .from('purchase_request_items')
        .select('*')
        .eq('purchase_request_id', requestId);

      if (itemsError) throw itemsError;

      await sendPurchaseNotification(requestId, items || [], request as Partial<PurchaseRequest>);
      
      toast.success('📧 E-mail reenviado com sucesso!');
      await loadRequests();
    } catch (error) {
      console.error('Error resending notification:', error);
      toast.error('Erro ao reenviar notificação');
    }
  };

  const loadRequestItems = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_request_items')
        .select(`
          *,
          item_cost_allocation(*)
        `)
        .eq('purchase_request_id', requestId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading request items:', error);
      return [];
    }
  };

  const saveCostAllocations = async (itemId: string, allocations: any[]) => {
    try {
      // Validar que soma dos % = 100%
      const totalPercentage = allocations.reduce((sum, a) => sum + a.allocation_percentage, 0);
      
      if (totalPercentage !== 100) {
        throw new Error('A soma dos percentuais deve ser 100%');
      }

      // Deletar rateios existentes
      await supabase
        .from('item_cost_allocation')
        .delete()
        .eq('purchase_request_item_id', itemId);

      // Inserir novos rateios
      const { error } = await supabase
        .from('item_cost_allocation')
        .insert(allocations);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving cost allocations:', error);
      throw error;
    }
  };

  return {
    requests,
    loading,
    metrics,
    createAutomaticRequest,
    updateRequestStatus,
    deleteRequest,
    saveRequest,
    loadRequestItems,
    saveCostAllocations,
    resendNotification,
    refreshRequests: loadRequests,
    refreshMetrics: loadMetrics,
  };
};
