import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotifyParams {
  orderId: string;
  oldStatus?: string;
  newStatus: string;
  orderType?: string;
  orderCategory?: string;
  notificationType?: 'new_order' | 'status_change' | 'urgent_alert';
  customMessage?: string;
}

export function usePhaseManagerNotification() {
  // Função para buscar status que disparam gatilhos do banco
  const getActiveTriggeredStatuses = useCallback(async (): Promise<string[]> => {
    const { data: triggerConfigs } = await supabase
      .from('ai_manager_trigger_config')
      .select('trigger_status')
      .eq('is_active', true);

    if (!triggerConfigs) return [];
    
    // Flatten all trigger_status arrays into a single array of unique statuses
    const allStatuses = triggerConfigs.flatMap(t => t.trigger_status || []);
    return [...new Set(allStatuses)];
  }, []);

  const notifyPhaseManager = useCallback(async (params: NotifyParams) => {
    const { orderId, oldStatus, newStatus, orderType, orderCategory, notificationType = 'status_change', customMessage } = params;

    // Buscar status que disparam gatilhos do banco de dados
    const triggeredStatuses = await getActiveTriggeredStatuses();
    
    // Verificar se o novo status dispara notificação
    if (!triggeredStatuses.includes(newStatus)) {
      console.log(`[usePhaseManagerNotification] Status ${newStatus} não está configurado para disparar notificação`);
      return { success: true, skipped: true };
    }

    // Evitar notificação duplicada se o status não mudou realmente
    if (oldStatus === newStatus) {
      console.log(`[usePhaseManagerNotification] Status não mudou, ignorando`);
      return { success: true, skipped: true };
    }

    try {
      console.log(`[usePhaseManagerNotification] Notificando gestor para pedido ${orderId}`);
      console.log(`[usePhaseManagerNotification] Mudança: ${oldStatus} -> ${newStatus}`);

      const { data, error } = await supabase.functions.invoke('notify-phase-manager', {
        body: {
          orderId,
          oldStatus,
          newStatus,
          orderType,
          orderCategory,
          notificationType,
          customMessage
        }
      });

      if (error) {
        console.error('[usePhaseManagerNotification] Erro:', error);
        return { success: false, error };
      }

      console.log('[usePhaseManagerNotification] Resposta:', data);

      if (data?.notifications_sent > 0) {
        toast.success(`Gestor notificado via WhatsApp`, {
          description: `${data.notifications_sent} notificação(ões) enviada(s)`
        });
      }

      return { success: true, data };
    } catch (error) {
      console.error('[usePhaseManagerNotification] Erro ao notificar:', error);
      return { success: false, error };
    }
  }, []);

  const notifyUrgent = useCallback(async (orderId: string, message?: string) => {
    // Buscar dados do pedido para determinar a fase
    const { data: order } = await supabase
      .from('orders')
      .select('status, order_type, order_category')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, error: 'Pedido não encontrado' };
    }

    return notifyPhaseManager({
      orderId,
      newStatus: order.status,
      orderType: order.order_type,
      orderCategory: order.order_category,
      notificationType: 'urgent_alert',
      customMessage: message
    });
  }, [notifyPhaseManager]);

  const notifyNewOrder = useCallback(async (orderId: string, status: string, orderCategory?: string) => {
    return notifyPhaseManager({
      orderId,
      newStatus: status,
      orderCategory,
      notificationType: 'new_order'
    });
  }, [notifyPhaseManager]);

  return {
    notifyPhaseManager,
    notifyUrgent,
    notifyNewOrder,
    getActiveTriggeredStatuses
  };
}
