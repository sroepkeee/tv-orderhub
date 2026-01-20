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
            phone,
            whatsapp
          ),
          orders (
            order_number,
            customer_name
          ),
          whatsapp_media (
            id,
            media_type,
            mime_type,
            file_name,
            file_size_bytes,
            base64_data,
            thumbnail_base64,
            duration_seconds,
            caption,
            ai_analysis,
            compliance_check
          )
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      
      // Parse response preservando estrutura aninhada do Supabase
      const parsedData = (data || []).map((conv: any) => ({
        ...conv,
        carrier: conv.carriers || null,
        order: conv.orders || null,
        media: conv.whatsapp_media || [],
      }));
      
      setConversations(parsedData as CarrierConversation[]);
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
          ),
          whatsapp_media (
            id,
            media_type,
            mime_type,
            file_name,
            file_size_bytes,
            base64_data,
            thumbnail_base64,
            duration_seconds,
            caption,
            ai_analysis,
            compliance_check
          )
        `)
        .eq('carrier_id', carrierId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const parsedData = (data || []).map((conv: any) => ({
        ...conv,
        carrier: conv.carriers || null,
        order: conv.orders || null,
        media: conv.whatsapp_media || [],
      }));
      
      setConversations(parsedData as CarrierConversation[]);
      return parsedData;
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
          ),
          whatsapp_media (
            id,
            media_type,
            mime_type,
            file_name,
            file_size_bytes,
            base64_data,
            thumbnail_base64,
            duration_seconds,
            caption,
            ai_analysis,
            compliance_check
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const parsedData = (data || []).map((conv: any) => ({
        ...conv,
        carrier: conv.carriers || null,
        order: conv.orders || null,
        media: conv.whatsapp_media || [],
      }));
      
      setConversations(parsedData as CarrierConversation[]);
      return parsedData;
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
    orderId?: string; // Optional for general conversations
    message: string;
    conversationType: string;
  }): Promise<{ success?: boolean; rate_limited?: boolean; error?: string; retry_after_seconds?: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-send', {
        body: messageData,
      });

      if (error) throw error;
      
      // Return rate limit info if present
      if (data?.rate_limited) {
        return {
          rate_limited: true,
          error: data.error,
          retry_after_seconds: data.retry_after_seconds
        };
      }

      console.log('Message sent via Mega API:', data);
      return data;
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
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

  // Sound generators using Web Audio API
  const playSound = (type: 'normal' | 'alert' | 'urgent') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'normal') {
        // Som suave - único beep curto
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'alert') {
        // Som de alerta - dois beeps agudos
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        
        // Segundo beep
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1400;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.4, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          osc2.start();
          osc2.stop(audioContext.currentTime + 0.15);
        }, 200);
      } else if (type === 'urgent') {
        // Som urgente - três beeps rápidos e agudos
        oscillator.frequency.value = 1600;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
        // Beeps adicionais
        [150, 300].forEach((delay) => {
          setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 1600;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.5, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
          }, delay);
        });
      }
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  };

  // Check message priority from sentiment cache
  const checkMessagePriority = async (carrierId: string): Promise<{ soundType: 'normal' | 'alert' | 'urgent', isHandoff: boolean }> => {
    try {
      const { data } = await supabase
        .from('conversation_sentiment_cache')
        .select('requires_human_handoff, sentiment')
        .eq('carrier_id', carrierId)
        .single();

      if (data?.requires_human_handoff) {
        return { soundType: 'urgent', isHandoff: true };
      }
      if (data?.sentiment === 'critical' || data?.sentiment === 'negative') {
        return { soundType: 'alert', isHandoff: false };
      }
      return { soundType: 'normal', isHandoff: false };
    } catch {
      return { soundType: 'normal', isHandoff: false };
    }
  };

  const subscribeToNewMessages = (onSync?: () => void, onHandoff?: (carrierId: string, carrierName?: string) => void) => {
    console.log('🔔 Setting up real-time subscription for carrier_conversations...');
    
    const channel = supabase
      .channel('carrier-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'carrier_conversations',
        },
        async (payload) => {
          console.log('📩 New message received:', payload.eventType, payload.new);
          
          // Chamar callback de sincronização
          onSync?.();
          
          // Atualizar contagem de não lidas
          getUnreadCount();
          
          // Recarregar conversas para atualizar a lista
          loadConversations();
          
          // Tocar som diferenciado para mensagens inbound
          if (payload.new && (payload.new as any).message_direction === 'inbound') {
            const carrierId = (payload.new as any).carrier_id;
            
            // Verificar prioridade e tocar som apropriado
            const { soundType, isHandoff } = await checkMessagePriority(carrierId);
            playSound(soundType);
            
            // Callback para handoff (notificação visual)
            if (isHandoff && onHandoff) {
              // Buscar nome do carrier
              const { data: carrier } = await supabase
                .from('carriers')
                .select('name')
                .eq('id', carrierId)
                .single();
              
              onHandoff(carrierId, carrier?.name);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'carrier_conversations',
        },
        (payload) => {
          console.log('📝 Message updated:', payload.eventType);
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    return () => {
      console.log('🔕 Removing real-time subscription');
      supabase.removeChannel(channel);
    };
  };

  const loadAllContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('id, name, whatsapp, is_active')
        .not('whatsapp', 'is', null)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      toast({
        title: 'Erro ao carregar contatos',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  };

  useEffect(() => {
    loadConversations();
    getUnreadCount();
  }, []);

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // ✅ Recalcular contador de não lidas
      await getUnreadCount();
      
      toast({
        title: 'Mensagem excluída',
        description: 'A mensagem foi removida.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir mensagem',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteAllCarrierConversations = async (carrierId: string) => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .eq('carrier_id', carrierId);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.carrier_id !== carrierId));
      
      // ✅ Recalcular contador de não lidas
      await getUnreadCount();
      
      toast({
        title: 'Conversas excluídas',
        description: 'Todas as mensagens com esta transportadora foram removidas.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir conversas',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  // Função para limpar TODAS as conversas (útil para testes)
  const deleteAllConversations = async () => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete ALL

      if (error) throw error;
      
      // Reset imediato do estado local
      setConversations([]);
      setUnreadCount(0);
      
      toast({
        title: 'Todas as conversas excluídas',
        description: 'O histórico foi limpo completamente.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir conversas',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    conversations,
    loading,
    unreadCount,
    loadConversations,
    loadConversationsByCarrier,
    loadConversationsByOrder,
    loadAllContacts,
    sendMessage,
    markAsRead,
    getUnreadCount,
    subscribeToNewMessages,
    deleteConversation,
    deleteAllCarrierConversations,
    deleteAllConversations,
  };
};
