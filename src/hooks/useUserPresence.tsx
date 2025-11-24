import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface OnlineUser {
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  online_at: string;
}

export function useUserPresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users');

    // Track presence
    const trackPresence = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, department')
          .eq('id', user.id)
          .single();

        if (profile) {
          await channel
            .on('presence', { event: 'sync' }, () => {
              const state = channel.presenceState<OnlineUser>();
              const users = Object.values(state).flat();
              setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
              console.log('👋 Usuário entrou:', newPresences);
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
              console.log('👋 Usuário saiu:', leftPresences);
            })
            .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                await channel.track({
                  user_id: user.id,
                  full_name: profile.full_name || 'Usuário',
                  email: profile.email || user.email || '',
                  department: profile.department || 'N/A',
                  online_at: new Date().toISOString(),
                });
                setIsTracking(true);
              }
            });
        }
      } catch (error) {
        console.error('Erro ao rastrear presença:', error);
      }
    };

    trackPresence();

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      setIsTracking(false);
    };
  }, [user]);

  return { onlineUsers, isTracking };
}
