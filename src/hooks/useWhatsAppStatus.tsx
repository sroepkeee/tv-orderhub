import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  loading: boolean;
  isAuthorized: boolean;
}

interface QRCodeData {
  qrcode: string;
  expiresIn: number;
}

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    status: 'unknown',
    loading: true,
    isAuthorized: false,
  });
  const [pollingInterval, setPollingInterval] = useState(30000); // Normal: 30s, Durante scan: 2s
  const { toast } = useToast();

  const checkAuthorization = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Verifica se está na tabela whatsapp_authorized_users
      const { data: whatsappAuth } = await supabase
        .from('whatsapp_authorized_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (whatsappAuth) return true;

      // Se não está na tabela, verifica se é admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      return !!adminRole;
    } catch (error) {
      console.error('Error checking authorization:', error);
      return false;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const isAuthorized = await checkAuthorization();
      
      if (!isAuthorized) {
        setStatus({
          connected: false,
          status: 'unauthorized',
          loading: false,
          isAuthorized: false,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('mega-api-status');

      if (error) {
        console.error('Error checking WhatsApp status:', error);
        setStatus({
          connected: false,
          status: 'error',
          loading: false,
          isAuthorized: true,
        });
        return;
      }

      setStatus({
        connected: data.connected || false,
        status: data.status || 'unknown',
        loading: false,
        isAuthorized: true,
      });

    } catch (error) {
      console.error('Error in checkStatus:', error);
      setStatus({
        connected: false,
        status: 'error',
        loading: false,
        isAuthorized: false,
      });
    }
  }, [checkAuthorization]);

  const getQRCode = useCallback(async (): Promise<QRCodeData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-qrcode');

      if (error) {
        console.error('Error getting QR code:', error);
        toast({
          title: 'Erro ao obter QR Code',
          description: 'Não foi possível gerar o QR Code',
          variant: 'destructive',
        });
        return null;
      }

      return {
        qrcode: data.qrcode,
        expiresIn: data.expiresIn || 60,
      };
    } catch (error) {
      console.error('Error in getQRCode:', error);
      return null;
    }
  }, [toast]);

  const startFastPolling = useCallback(() => {
    setPollingInterval(2000); // Polling rápido durante escaneamento
  }, []);

  const stopFastPolling = useCallback(() => {
    setPollingInterval(30000); // Volta ao polling normal
  }, []);

  useEffect(() => {
    checkStatus();

    // Polling dinâmico baseado no intervalo atual
    const interval = setInterval(checkStatus, pollingInterval);

    return () => clearInterval(interval);
  }, [checkStatus, pollingInterval]);

  return {
    ...status,
    refresh: checkStatus,
    getQRCode,
    startFastPolling,
    stopFastPolling,
  };
}
