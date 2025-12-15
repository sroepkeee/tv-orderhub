import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shouldNotifyForStatus } from "@/lib/notificationPhases";

interface AIAgentConfig {
  is_active: boolean;
  notification_phases: string[];
}

export function useAIAgentNotification() {
  // Buscar configuração do agente
  const getAgentConfig = useCallback(async (): Promise<AIAgentConfig | null> => {
    try {
      const { data } = await supabase
        .from('ai_agent_config')
        .select('is_active, notification_phases')
        .limit(1)
        .single();
      
      return data as AIAgentConfig | null;
    } catch (error) {
      console.error('Error fetching AI agent config:', error);
      return null;
    }
  }, []);

  // Disparar notificação quando status muda
  const triggerStatusNotification = useCallback(async (
    orderId: string,
    newStatus: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // Buscar configuração
      const config = await getAgentConfig();
      
      if (!config?.is_active) {
        console.log('AI Agent not active, skipping notification');
        return { success: false, message: 'Agent not active' };
      }

      const enabledPhases = config.notification_phases || [];
      const { shouldNotify, phase } = shouldNotifyForStatus(newStatus, enabledPhases);

      if (!shouldNotify) {
        console.log('Status not configured for notification:', newStatus);
        return { success: false, message: 'Status not in notification phases' };
      }

      console.log(`Triggering AI notification for order ${orderId}, status: ${newStatus}, phase: ${phase}`);

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('ai-agent-notify', {
        body: {
          order_id: orderId,
          trigger_type: 'status_change',
          new_status: newStatus,
        },
      });

      if (error) {
        console.error('Error triggering AI notification:', error);
        return { success: false, message: error.message };
      }

      console.log('AI notification response:', data);
      return { success: true };

    } catch (error: any) {
      console.error('Error in triggerStatusNotification:', error);
      return { success: false, message: error?.message };
    }
  }, [getAgentConfig]);

  return {
    triggerStatusNotification,
    getAgentConfig,
  };
}
