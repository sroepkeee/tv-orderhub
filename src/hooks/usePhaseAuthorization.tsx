import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PhasePermission {
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

interface UserPhasePermission {
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

// Roles que têm acesso total automaticamente
const FULL_ACCESS_ROLES = ['admin', 'manager'];

export const usePhaseAuthorization = () => {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [phasePermissions, setPhasePermissions] = useState<PhasePermission[]>([]);
  const [userPhasePermissions, setUserPhasePermissions] = useState<UserPhasePermission[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadUserData();

    // Real-time subscription para mudanças de permissões
    const subscription = supabase
      .channel('phase-permissions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'phase_permissions'
      }, () => {
        console.log('🔄 [Phase Authorization] Role permissions changed, reloading...');
        loadUserData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_phase_permissions'
      }, () => {
        console.log('🔄 [Phase Authorization] User permissions changed, reloading...');
        loadUserData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
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
      
      console.log('🔐 [Phase Authorization] User Roles:', roles);
      setUserRoles(roles);

      // Verificar se tem role com acesso total
      const hasFullAccess = roles.some(role => FULL_ACCESS_ROLES.includes(role));

      // Carregar status de aprovação
      const { data: approvalData, error: approvalError } = await supabase
        .from('user_approval_status')
        .select('status')
        .eq('user_id', user?.id)
        .single();

      if (approvalError && approvalError.code !== 'PGRST116') throw approvalError;
      setIsApproved(approvalData?.status === 'approved');

      // Se tem acesso total, não precisa buscar permissões granulares
      if (hasFullAccess) {
        console.log('✅ [Phase Authorization] User has full access role');
        setPhasePermissions([]);
        setUserPhasePermissions([]);
        setLoading(false);
        return;
      }

      // Buscar permissões de role da tabela phase_permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('phase_permissions')
        .select('*')
        .in('role', roles);

      if (permissionsError) throw permissionsError;
      
      console.log('📊 [Phase Authorization] Loading role permissions for:', roles);
      
      // Merge de permissões de múltiplas roles
      const mergedPermissions = new Map<string, PhasePermission>();
      
      permissionsData?.forEach(perm => {
        const existing = mergedPermissions.get(perm.phase_key);
        if (existing) {
          mergedPermissions.set(perm.phase_key, {
            phase_key: perm.phase_key,
            can_view: existing.can_view || perm.can_view,
            can_edit: existing.can_edit || perm.can_edit,
            can_advance: existing.can_advance || (perm.can_advance ?? false),
            can_delete: existing.can_delete || perm.can_delete,
          });
        } else {
          mergedPermissions.set(perm.phase_key, {
            phase_key: perm.phase_key,
            can_view: perm.can_view,
            can_edit: perm.can_edit,
            can_advance: perm.can_advance ?? false,
            can_delete: perm.can_delete,
          });
        }
      });

      const rolePermissions = Array.from(mergedPermissions.values());
      setPhasePermissions(rolePermissions);

      // Buscar permissões individuais do usuário
      const { data: userPermData, error: userPermError } = await supabase
        .from('user_phase_permissions')
        .select('*')
        .eq('user_id', user?.id);

      if (userPermError) throw userPermError;

      const userPerms: UserPhasePermission[] = (userPermData || []).map(p => ({
        phase_key: p.phase_key,
        can_view: p.can_view ?? false,
        can_edit: p.can_edit ?? false,
        can_advance: p.can_advance ?? false,
        can_delete: p.can_delete ?? false,
      }));

      console.log('👤 [Phase Authorization] User individual permissions:', userPerms.length);
      setUserPhasePermissions(userPerms);

    } catch (error) {
      console.error('❌ [Phase Authorization] Error loading user data:', error);
      setUserRoles([]);
      setPhasePermissions([]);
      setUserPhasePermissions([]);
      setIsApproved(false);
    } finally {
      setLoading(false);
    }
  };

  // Verificar se usuário tem role com acesso total
  const hasFullAccess = (): boolean => {
    return userRoles.some(role => FULL_ACCESS_ROLES.includes(role));
  };

  // Combinar permissões de role + individuais (OR lógico)
  const getEffectivePermission = (phase: string): PhasePermission | null => {
    const rolePermission = phasePermissions.find(p => p.phase_key === phase);
    const userPermission = userPhasePermissions.find(p => p.phase_key === phase);

    if (!rolePermission && !userPermission) return null;

    return {
      phase_key: phase,
      can_view: (rolePermission?.can_view ?? false) || (userPermission?.can_view ?? false),
      can_edit: (rolePermission?.can_edit ?? false) || (userPermission?.can_edit ?? false),
      can_advance: (rolePermission?.can_advance ?? false) || (userPermission?.can_advance ?? false),
      can_delete: (rolePermission?.can_delete ?? false) || (userPermission?.can_delete ?? false),
    };
  };

  const canViewPhase = (phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_view ?? false;
  };

  const canEditPhase = (phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_edit ?? false;
  };

  const canAdvancePhase = (phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_advance ?? false;
  };

  const canDeleteFromPhase = (phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_delete ?? false;
  };

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role) || hasFullAccess();
  };

  return { 
    userRoles, 
    phasePermissions,
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
