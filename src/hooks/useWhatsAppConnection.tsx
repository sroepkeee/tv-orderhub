import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionInfo {
  connected: boolean;
  status: string;
  phoneNumber?: string;
  lastConnection?: Date;
}

interface WebhookStatus {
  active: boolean;
  lastReceived?: Date;
}

export function useWhatsAppConnection() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const getConnectionInfo = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-status');
      
      if (error) throw error;

      setConnectionInfo({
        connected: data?.connected || false,
        status: data?.status || 'unknown',
        phoneNumber: data?.phoneNumber,
        lastConnection: data?.lastConnection ? new Date(data.lastConnection) : undefined,
      });

      return data;
    } catch (error) {
      console.error('Error getting connection info:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const testWebhook = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-test-webhook');
      
      if (error) throw error;

      const webhookData: WebhookStatus = {
        active: data?.success || false,
        lastReceived: data?.lastWebhookReceived ? new Date(data.lastWebhookReceived) : undefined,
      };

      setWebhookStatus(webhookData);
      return webhookData;
    } catch (error) {
      console.error('Error testing webhook:', error);
      return { active: false };
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      // TODO: Implementar endpoint de desconexão na Mega API
      console.log('Disconnect function not implemented yet');
      return { success: false, message: 'Função em desenvolvimento' };
    } catch (error) {
      console.error('Error disconnecting:', error);
      return { success: false, message: 'Erro ao desconectar' };
    }
  }, []);

  return {
    connectionInfo,
    webhookStatus,
    loading,
    getConnectionInfo,
    testWebhook,
    disconnect,
  };
}
