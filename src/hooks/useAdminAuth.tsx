import { usePhaseAuthorization } from './usePhaseAuthorization';

export const useAdminAuth = () => {
  const { hasRole, loading } = usePhaseAuthorization();
  
  const isAdmin = hasRole('admin');
  
  return { isAdmin, loading };
};
