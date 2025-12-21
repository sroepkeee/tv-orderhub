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

// Status que disparam notificação para gestores
const TRIGGER_STATUSES: Record<string, string> = {
  // Compras
  'purchase_pending': 'purchases',
  'purchase_required': 'purchases',
  'awaiting_material': 'purchases',
  // Produção
  'separation_started': 'production',
  'in_production': 'production',
  // Laboratório
  'awaiting_lab': 'laboratory',
  'in_lab_analysis': 'laboratory',
  // Frete
  'freight_quote_requested': 'freight_quote',
  // Expedição
  'released_for_shipping': 'logistics',
  'in_expedition': 'logistics',
};

export function usePhaseManagerNotification() {
  const notifyPhaseManager = useCallback(async (params: NotifyParams) => {
    const { orderId, oldStatus, newStatus, orderType, orderCategory, notificationType = 'status_change', customMessage } = params;

    // Verificar se o novo status dispara notificação
    if (!TRIGGER_STATUSES[newStatus]) {
      console.log(`[usePhaseManagerNotification] Status ${newStatus} não dispara notificação`);
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
    notifyNewOrder
  };
}
