import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';

// Chaves de menu disponíveis no sistema
export const ALL_MENU_KEYS = [
  'kanban',
  'metrics', 
  'producao',
  'files',
  'transportadoras',
  'carriers-chat',
  'compras',
  'customers',
  'admin',
  'ai-agent',
  'settings'
] as const;

export type MenuKey = typeof ALL_MENU_KEYS[number];

interface MenuPermission {
  menu_key: string;
  can_view: boolean;
}

export const useMenuPermissions = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const [menuPermissions, setMenuPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Admin vê tudo por padrão
    if (isAdmin) {
      const allVisible: Record<string, boolean> = {};
      ALL_MENU_KEYS.forEach(key => { allVisible[key] = true; });
      setMenuPermissions(allVisible);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('menu_permissions')
        .select('menu_key, can_view')
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao carregar permissões de menu:', error);
        // Em caso de erro, permitir tudo
        const allVisible: Record<string, boolean> = {};
        ALL_MENU_KEYS.forEach(key => { allVisible[key] = true; });
        setMenuPermissions(allVisible);
        setLoading(false);
        return;
      }

      const perms: Record<string, boolean> = {};
      
      // Menus sem configuração explícita = visíveis por padrão
      ALL_MENU_KEYS.forEach(key => {
        perms[key] = true;
      });

      // Aplicar configurações explícitas
      (data as MenuPermission[] || []).forEach(p => {
        perms[p.menu_key] = p.can_view;
      });

      setMenuPermissions(perms);
    } catch (error) {
      console.error('Erro ao carregar permissões de menu:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    loadPermissions();

    if (!user) return;

    // Real-time subscription para atualizações
    const channel = supabase
      .channel('menu-permissions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_permissions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('🔄 [Menu Permissions] Permissões atualizadas, recarregando...');
        loadPermissions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadPermissions]);

  const canViewMenu = useCallback((key: string): boolean => {
    // Admin sempre pode ver tudo
    if (isAdmin) return true;
    // Se não tem configuração, permitir por padrão
    return menuPermissions[key] ?? true;
  }, [menuPermissions, isAdmin]);

  return { 
    menuPermissions, 
    canViewMenu, 
    loading,
    refetch: loadPermissions
  };
};
