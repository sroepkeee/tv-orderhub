import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shouldNotifyForStatus } from "@/lib/notificationPhases";

/**
 * Hook para disparar notificações ao cliente quando pedido é criado ou status muda
 */
export function useOrderNotification() {
  
  /**
   * Dispara notificação para um pedido (criação ou mudança de status)
   */
  const triggerNotification = useCallback(async (
    orderId: string,
    status: string,
    triggerType: 'status_change' | 'order_created' = 'status_change'
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // Buscar configuração do agente
      const { data: config } = await supabase
        .from('ai_agent_config')
        .select('is_active, notification_phases')
        .eq('agent_type', 'customer')
        .limit(1)
        .single();
      
      if (!config?.is_active) {
        console.log('🔕 [useOrderNotification] AI Agent not active, skipping');
        return { success: false, message: 'Agent not active' };
      }

      const enabledPhases = config.notification_phases || [];
      const { shouldNotify, phase } = shouldNotifyForStatus(status, enabledPhases);

      if (!shouldNotify) {
        console.log('🔕 [useOrderNotification] Status not in notification phases:', status);
        return { success: false, message: 'Status not in notification phases' };
      }

      console.log(`📬 [useOrderNotification] Triggering notification for order ${orderId}, status: ${status}, phase: ${phase}, type: ${triggerType}`);

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('ai-agent-notify', {
        body: {
          order_id: orderId,
          trigger_type: triggerType,
          new_status: status,
        },
      });

      if (error) {
        console.error('❌ [useOrderNotification] Error:', error);
        return { success: false, message: error.message };
      }

      console.log('✅ [useOrderNotification] Response:', data);
      return { success: true };

    } catch (error: any) {
      console.error('❌ [useOrderNotification] Exception:', error);
      return { success: false, message: error?.message };
    }
  }, []);

  /**
   * Dispara notificação após criação de pedido
   */
  const notifyOrderCreated = useCallback(async (orderId: string, initialStatus: string) => {
    console.log(`📦 [useOrderNotification] Order created: ${orderId} with status ${initialStatus}`);
    return triggerNotification(orderId, initialStatus, 'order_created');
  }, [triggerNotification]);

  /**
   * Dispara notificação após mudança de status
   */
  const notifyStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    console.log(`🔄 [useOrderNotification] Status changed: ${orderId} to ${newStatus}`);
    return triggerNotification(orderId, newStatus, 'status_change');
  }, [triggerNotification]);

  return {
    triggerNotification,
    notifyOrderCreated,
    notifyStatusChange,
  };
}
