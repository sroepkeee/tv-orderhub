import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * Hook wrapper para verificar se o usuário é admin.
 * Usa o PermissionsContext centralizado para evitar queries duplicadas.
 */
export const useAdminAuth = () => {
  const { isAdmin, loading } = usePermissions();
  return { isAdmin, loading };
};
