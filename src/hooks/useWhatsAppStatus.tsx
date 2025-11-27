import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  loading: boolean;
  isAuthorized: boolean;
  phoneNumber?: string;
  connectedAt?: Date;
  instanceName?: string;
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
    phoneNumber: undefined,
    connectedAt: undefined,
    instanceName: undefined,
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
        phoneNumber: data.phoneNumber,
        connectedAt: data.connectedAt ? new Date(data.connectedAt) : undefined,
        instanceName: data.instanceName || 'Imply Frete',
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

  const disconnect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-logout');

      if (error) {
        console.error('Error disconnecting WhatsApp:', error);
        toast({
          title: 'Erro ao desconectar',
          description: 'Não foi possível desconectar o WhatsApp',
          variant: 'destructive',
        });
        return false;
      }

      // Atualizar estado local
      setStatus(prev => ({
        ...prev,
        connected: false,
        status: 'disconnected',
        phoneNumber: undefined,
        connectedAt: undefined,
      }));

      toast({
        title: 'WhatsApp Desconectado',
        description: 'A conexão foi encerrada com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Error in disconnect:', error);
      toast({
        title: 'Erro ao desconectar',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const updateInstanceName = useCallback(async (name: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-update-instance', {
        body: { name },
      });

      if (error) {
        console.error('Error updating instance name:', error);
        toast({
          title: 'Erro ao atualizar nome',
          description: 'Não foi possível atualizar o nome da instância',
          variant: 'destructive',
        });
        return false;
      }

      // Atualizar estado local
      setStatus(prev => ({
        ...prev,
        instanceName: data.name,
      }));

      toast({
        title: 'Nome Atualizado',
        description: 'O nome da instância foi atualizado com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Error in updateInstanceName:', error);
      toast({
        title: 'Erro ao atualizar nome',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

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
    disconnect,
    updateInstanceName,
  };
}
