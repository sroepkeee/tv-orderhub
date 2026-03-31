import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  order_id: string;
  comment_id?: string;
  is_read: boolean;
  created_at: string;
  metadata: any;
  mentioned_by?: {
    full_name: string;
    email: string;
  };
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!user) {
      console.log('🔔 [useNotifications] Usuário não autenticado');
      return;
    }

    console.log('🔔 [useNotifications] Usuário autenticado:', {
      id: user.id,
      email: user.email
    });

    loadNotifications();
    
    // Realtime subscription
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Nova notificação recebida:', payload);
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Mostrar notificação desktop
          showDesktopNotification(newNotif);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Notificação atualizada:', payload);
          const updatedNotif = payload.new as Notification;
          setNotifications(prev => 
            prev.map(n => n.id === updatedNotif.id ? updatedNotif : n)
          );
          updateUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadNotifications = useCallback(async (attempt: number = 0) => {
    if (!user?.id) {
      console.log('🔔 [useNotifications] Usuário não está pronto ainda');
      return;
    }

    const startTime = Date.now();
    console.log('🔔 [useNotifications] Iniciando carregamento...', { 
      userId: user.id, 
      email: user.email,
      attempt: attempt + 1 
    });

    try {
      setError(null);
      if (attempt > 0) {
        setIsRetrying(true);
      }

      // Query simples de notificações (usa metadata.author_name para exibição)
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select('*, comment_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const duration = Date.now() - startTime;
      console.log('🔔 [useNotifications] Query executada', { 
        duration: `${duration}ms`,
        success: !notifError 
      });

      if (notifError) {
        console.error('🔔 [useNotifications] Erro na query:', {
          message: notifError.message,
          code: notifError.code,
          details: notifError.details,
          hint: notifError.hint
        });
        throw notifError;
      }

      // Validar dados recebidos
      if (!Array.isArray(notificationsData)) {
        console.error('🔔 [useNotifications] Dados inválidos recebidos:', notificationsData);
        throw new Error('Formato de dados inválido');
      }

      if (notificationsData.length === 0) {
        console.log('🔔 [useNotifications] Nenhuma notificação encontrada');
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        setIsRetrying(false);
        setRetryCount(0);
        return;
      }

      console.log('🔔 [useNotifications] Notificações carregadas:', {
        total: notificationsData.length,
        unread: notificationsData.filter((n: any) => !n.is_read).length,
        withMetadata: notificationsData.filter((n: any) => n.metadata?.author_name).length
      });

      // Transformar dados (usa metadata.author_name preenchido pelo trigger)
      const enrichedNotifications: Notification[] = notificationsData.map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        order_id: notif.order_id,
        is_read: notif.is_read,
        created_at: notif.created_at,
        metadata: notif.metadata || {},
        mentioned_by: notif.metadata?.author_name ? {
          full_name: notif.metadata.author_name,
          email: notif.metadata.author_email || ''
        } : undefined
      }));

      setNotifications(enrichedNotifications);
      
      // Atualizar contagem com try-catch separado
      try {
        await updateUnreadCount();
      } catch (countError) {
        console.error('🔔 [useNotifications] Erro ao atualizar contagem (não crítico):', countError);
        // Calcular contagem localmente como fallback
        const localUnreadCount = enrichedNotifications.filter(n => !n.is_read).length;
        setUnreadCount(localUnreadCount);
      }

      setRetryCount(0);
      setIsRetrying(false);
      console.log('🔔 [useNotifications] ✅ Carregamento concluído com sucesso');

    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error('🔔 [useNotifications] ❌ Erro ao carregar notificações:', {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        duration: `${duration}ms`,
        error: err.message,
        code: err.code,
        userId: user.id
      });

      // Retry automático
      if (attempt < MAX_RETRIES) {
        console.log(`🔔 [useNotifications] 🔄 Tentando novamente em ${RETRY_DELAY}ms...`);
        setRetryCount(attempt + 1);
        setTimeout(() => {
          loadNotifications(attempt + 1);
        }, RETRY_DELAY);
        return;
      }

      // Falha após todas as tentativas
      setError('Não foi possível carregar as notificações');
      setNotifications([]);
      setIsRetrying(false);
      
      toast({
        title: 'Erro ao carregar notificações',
        description: `Não foi possível carregar suas notificações após ${MAX_RETRIES} tentativas. Verifique sua conexão.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('🔔 [updateUnreadCount] Erro:', err);
      // Não propagar erro, usar contagem local
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    // Atualizar estado local imediatamente (optimistic)
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);

    if (error) {
      console.error('🔔 [markAsRead] Erro:', error);
      // Reverter em caso de erro
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n)
      );
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const previousNotifications = notifications;
    const previousCount = unreadCount;

    // Atualizar estado local imediatamente
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('🔔 [markAllAsRead] Erro:', error);
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    } else {
      toast({
        title: 'Todas as notificações foram marcadas como lidas',
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('🔔 [deleteNotification] Erro:', error);
      // Reverter
      if (notification) {
        setNotifications(prev => [...prev, notification].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
        if (!notification.is_read) {
          setUnreadCount(prev => prev + 1);
        }
      }
    }
  };

  // Notificações desktop
  const showDesktopNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isRetrying,
    retryCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission,
    refreshNotifications: () => loadNotifications(0)
  };
};
