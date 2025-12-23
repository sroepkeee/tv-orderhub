import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * Interface para permissão de fase do usuário.
 */
export interface UserPhasePermission {
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

/**
 * Hook wrapper para autorização de fases.
 * Usa o PermissionsContext centralizado para evitar queries duplicadas.
 */
export const usePhaseAuthorization = () => {
  const { 
    userRoles, 
    userPhasePermissions,
    isApproved,
    canViewPhase, 
    canEditPhase, 
    canAdvancePhase,
    canDeleteFromPhase,
    hasRole,
    hasFullAccess,
    loading 
  } = usePermissions();

  return { 
    userRoles, 
    userPhasePermissions,
    isApproved,
    canViewPhase, 
    canEditPhase, 
    canAdvancePhase,
    canDeleteFromPhase,
    hasRole,
    hasFullAccess,
    loading 
  };
};
