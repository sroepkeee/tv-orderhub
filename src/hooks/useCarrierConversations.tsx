import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CarrierConversation } from '@/types/carriers';

// Helper para evitar timeout em queries lentas
function fetchWithTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Timeout ao carregar conversas')), ms);
    promise.then(
      (res) => { clearTimeout(timeoutId); resolve(res); },
      (err) => { clearTimeout(timeoutId); reject(err); }
    );
  });
}

export const useCarrierConversations = () => {
  const [conversations, setConversations] = useState<CarrierConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const loadConversations = async () => {
    setLoading(true);
    try {
      // Filtrar últimos 180 dias e limitar a 500 registros
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      
      const query = supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            whatsapp
          )
        `)
        .gte('sent_at', sixMonthsAgo.toISOString())
        .order('sent_at', { ascending: false })
        .limit(500);

      const { data, error } = await fetchWithTimeout(Promise.resolve(query));

      if (error) throw error;
      setConversations((data || []) as unknown as CarrierConversation[]);
    } catch (error: any) {
      console.error('[useCarrierConversations] loadConversations error:', error);
      toast({
        title: 'Erro ao carregar conversas',
        description: error.message,
        variant: 'destructive',
      });
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationsByCarrier = async (carrierId: string) => {
    setLoading(true);
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      
      const query = supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            whatsapp,
            phone
          )
        `)
        .eq('carrier_id', carrierId)
        .gte('sent_at', sixMonthsAgo.toISOString())
        .order('sent_at', { ascending: true })
        .limit(500);

      const { data, error } = await fetchWithTimeout(Promise.resolve(query));

      if (error) throw error;
      
      setConversations((data || []) as unknown as CarrierConversation[]);
      return data || [];
    } catch (error: any) {
      console.error('[useCarrierConversations] loadConversationsByCarrier error:', error);
      toast({
        title: 'Erro ao carregar conversa',
        description: error.message,
        variant: 'destructive',
      });
      setConversations([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadConversationsByOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      
      const query = supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            whatsapp,
            phone
          )
        `)
        .eq('order_id', orderId)
        .gte('sent_at', sixMonthsAgo.toISOString())
        .order('sent_at', { ascending: true })
        .limit(500);

      const { data, error } = await fetchWithTimeout(Promise.resolve(query));

      if (error) throw error;
      
      setConversations((data || []) as unknown as CarrierConversation[]);
      return data || [];
    } catch (error: any) {
      console.error('[useCarrierConversations] loadConversationsByOrder error:', error);
      toast({
        title: 'Erro ao carregar conversas',
        description: error.message,
        variant: 'destructive',
      });
      setConversations([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageData: {
    carrierId: string;
    orderId: string;
    message: string;
    conversationType: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-carrier-message', {
        body: messageData,
      });

      if (error) throw error;

      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada com sucesso.',
      });

      await loadConversations();
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .update({ read_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error marking as read:', error);
    }
  };

  const getUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('carrier_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('message_direction', 'inbound')
        .is('read_at', null);

      if (error) throw error;
      setUnreadCount(count || 0);
      return count || 0;
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  const subscribeToNewMessages = () => {
    const channel = supabase
      .channel('carrier-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'carrier_conversations',
          filter: 'message_direction=eq.inbound',
        },
        () => {
          loadConversations();
          getUnreadCount();
          
          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWm98OScTgwOUKjl8bllHAU7k9nzzHkpBSh+zPLaizsKGGS54+ydUwYPVq/n77NYGws+k9bzzXcsBSh/zfPci0ELFGCu6PGlVBUIQ5zd8L9yIQUqf8/z24k5CBV');
          audio.play().catch(() => {}); // Ignore errors
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    loadConversations();
    getUnreadCount();
  }, []);

  return {
    conversations,
    loading,
    unreadCount,
    loadConversations,
    loadConversationsByCarrier,
    loadConversationsByOrder,
    sendMessage,
    markAsRead,
    getUnreadCount,
    subscribeToNewMessages,
  };
};
