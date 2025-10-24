import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CarrierConversation } from '@/types/carriers';

export const useCarrierConversations = () => {
  const [conversations, setConversations] = useState<CarrierConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            email,
            phone
          ),
          orders (
            order_number,
            customer_name
          )
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setConversations((data || []) as unknown as CarrierConversation[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar conversas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConversationsByCarrier = async (carrierId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            email,
            quote_email,
            whatsapp,
            phone,
            contact_person
          ),
          orders (
            order_number,
            customer_name
          )
        `)
        .eq('carrier_id', carrierId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      
      setConversations((data || []) as unknown as CarrierConversation[]);
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar conversa',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadConversationsByOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select(`
          *,
          carriers (
            id,
            name,
            email,
            quote_email,
            whatsapp,
            phone,
            contact_person
          ),
          orders (
            order_number,
            customer_name
          )
        `)
        .eq('order_id', orderId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      
      setConversations((data || []) as unknown as CarrierConversation[]);
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar conversas',
        description: error.message,
        variant: 'destructive',
      });
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
