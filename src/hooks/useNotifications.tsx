import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  order_id: string;
  is_read: boolean;
  created_at: string;
  metadata: any;
  mentioned_by?: {
    full_name: string;
    email: string;
  };
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadNotifications = async () => {
    if (!user) return;

    console.log('🔔 [useNotifications] Iniciando carregamento...', { userId: user.id });

    try {
      setError(null);

      // 1. Buscar notificações
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifError) {
        console.error('🔔 [useNotifications] Erro ao carregar notificações:', notifError);
        throw notifError;
      }

      if (!notificationsData || notificationsData.length === 0) {
        console.log('🔔 [useNotifications] Nenhuma notificação encontrada');
        setNotifications([]);
        setLoading(false);
        return;
      }

      console.log('🔔 [useNotifications] Notificações brutas carregadas:', notificationsData);

      // 2. Buscar perfis dos autores (mentioned_by)
      const authorIds = [
        ...new Set(
          notificationsData
            .map(n => n.mentioned_by)
            .filter(Boolean)
        )
      ] as string[];

      let authorsMap = new Map();
      if (authorIds.length > 0) {
        console.log('🔔 [useNotifications] Buscando perfis dos autores:', authorIds);
        
        const { data: authorsData, error: authorsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', authorIds);

        if (authorsError) {
          console.error('🔔 [useNotifications] Erro ao buscar autores:', authorsError);
        } else {
          console.log('🔔 [useNotifications] Perfis dos autores carregados:', authorsData);
          authorsMap = new Map(
            authorsData?.map(p => [p.id, p]) || []
          );
        }
      }

      // 3. Combinar dados
      const enrichedNotifications: Notification[] = notificationsData.map(notif => ({
        ...notif,
        mentioned_by: notif.mentioned_by 
          ? authorsMap.get(notif.mentioned_by)
          : undefined
      }));

      console.log('🔔 [useNotifications] Notificações enriquecidas:', {
        total: enrichedNotifications.length,
        unread: enrichedNotifications.filter(n => !n.is_read).length,
        notifications: enrichedNotifications
      });

      setNotifications(enrichedNotifications);
      updateUnreadCount();
    } catch (err) {
      console.error('🔔 [useNotifications] Erro fatal ao carregar notificações:', err);
      setError('Não foi possível carregar as notificações');
      setNotifications([]);
      toast({
        title: 'Erro ao carregar notificações',
        description: 'Não foi possível carregar suas notificações. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUnreadCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setUnreadCount(count || 0);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setUnreadCount(0);
  };

  const deleteNotification = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
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
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission,
    refreshNotifications: loadNotifications
  };
};
