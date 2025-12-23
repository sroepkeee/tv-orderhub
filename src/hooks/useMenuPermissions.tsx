import { usePermissions } from '@/contexts/PermissionsContext';

// Re-export menu keys for backward compatibility
export { ALL_MENU_KEYS, type MenuKey } from '@/contexts/PermissionsContext';

/**
 * Hook wrapper para permissões de menu.
 * Usa o PermissionsContext centralizado para evitar queries duplicadas.
 */
export const useMenuPermissions = () => {
  const { menuPermissions, canViewMenu, loading, refetch, isAdmin } = usePermissions();
  
  return { 
    menuPermissions, 
    canViewMenu, 
    loading,
    isAdmin,
    refetch
  };
};
