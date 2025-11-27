import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  loading: boolean;
  isAuthorized: boolean;
}

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    status: 'unknown',
    loading: true,
    isAuthorized: false,
  });
  const { toast } = useToast();

  const checkAuthorization = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('whatsapp_authorized_users')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      return !error && !!data;
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

  useEffect(() => {
    checkStatus();

    // Polling a cada 30 segundos
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    ...status,
    refresh: checkStatus,
  };
}
