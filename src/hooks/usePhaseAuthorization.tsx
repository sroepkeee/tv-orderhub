import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PhasePermission {
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const usePhaseAuthorization = () => {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [phasePermissions, setPhasePermissions] = useState<PhasePermission[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      // Carregar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (rolesError) throw rolesError;
      const roles = rolesData?.map((r: any) => r.role) || [];
      setUserRoles(roles);

      // Carregar status de aprovação
      const { data: approvalData, error: approvalError } = await supabase
        .from('user_approval_status')
        .select('status')
        .eq('user_id', user?.id)
        .single();

      if (approvalError && approvalError.code !== 'PGRST116') throw approvalError;
      setIsApproved(approvalData?.status === 'approved');

      // Carregar permissões de fases (merged de todas as roles do usuário)
      if (roles.length > 0) {
        const { data: permissionsData, error: permissionsError } = await supabase
          .from('phase_permissions')
          .select('phase_key, can_view, can_edit, can_delete')
          .in('role', roles);

        if (permissionsError) throw permissionsError;

        // Merge permissions (se tem permissão em qualquer role, tem permissão)
        const mergedPermissions = new Map<string, PhasePermission>();
        
        permissionsData?.forEach((perm: any) => {
          const existing = mergedPermissions.get(perm.phase_key);
          if (existing) {
            mergedPermissions.set(perm.phase_key, {
              phase_key: perm.phase_key,
              can_view: existing.can_view || perm.can_view,
              can_edit: existing.can_edit || perm.can_edit,
              can_delete: existing.can_delete || perm.can_delete,
            });
          } else {
            mergedPermissions.set(perm.phase_key, perm);
          }
        });

        setPhasePermissions(Array.from(mergedPermissions.values()));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserRoles([]);
      setPhasePermissions([]);
      setIsApproved(false);
    } finally {
      setLoading(false);
    }
  };

  const canViewPhase = (phase: string): boolean => {
    if (userRoles.includes('admin')) return true;
    const permission = phasePermissions.find(p => p.phase_key === phase);
    return permission?.can_view ?? false;
  };

  const canEditPhase = (phase: string): boolean => {
    if (userRoles.includes('admin')) return true;
    const permission = phasePermissions.find(p => p.phase_key === phase);
    return permission?.can_edit ?? false;
  };

  const canDeleteFromPhase = (phase: string): boolean => {
    if (userRoles.includes('admin')) return true;
    const permission = phasePermissions.find(p => p.phase_key === phase);
    return permission?.can_delete ?? false;
  };

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role) || userRoles.includes('admin');
  };

  return { 
    userRoles, 
    phasePermissions,
    isApproved,
    canViewPhase, 
    canEditPhase, 
    canDeleteFromPhase,
    hasRole, 
    loading 
  };
};
