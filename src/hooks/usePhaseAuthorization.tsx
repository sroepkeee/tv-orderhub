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
        console.log('🔄 [Phase Authorization] Permissions changed, reloading...');
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

      // Carregar status de aprovação
      const { data: approvalData, error: approvalError } = await supabase
        .from('user_approval_status')
        .select('status')
        .eq('user_id', user?.id)
        .single();

      if (approvalError && approvalError.code !== 'PGRST116') throw approvalError;
      setIsApproved(approvalData?.status === 'approved');

      // Buscar permissões da tabela phase_permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('phase_permissions')
        .select('*')
        .in('role', roles);

      if (permissionsError) throw permissionsError;
      
      console.log('📊 [Phase Authorization] Calculating permissions from database for roles:', roles);
      
      // Merge de permissões de múltiplas roles
      const mergedPermissions = new Map<string, PhasePermission>();
      
      permissionsData?.forEach(perm => {
        console.log(`   → Role "${perm.role}" → Phase "${perm.phase_key}":`, {
          view: perm.can_view,
          edit: perm.can_edit,
          delete: perm.can_delete
        });
        
        const existing = mergedPermissions.get(perm.phase_key);
        if (existing) {
          // Merge: se qualquer role dá permissão, o usuário tem
          mergedPermissions.set(perm.phase_key, {
            phase_key: perm.phase_key,
            can_view: existing.can_view || perm.can_view,
            can_edit: existing.can_edit || perm.can_edit,
            can_delete: existing.can_delete || perm.can_delete,
          });
        } else {
          mergedPermissions.set(perm.phase_key, {
            phase_key: perm.phase_key,
            can_view: perm.can_view,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
          });
        }
      });

      const finalPermissions = Array.from(mergedPermissions.values());
      console.log('✅ [Phase Authorization] Final Permissions:', finalPermissions);
      console.log('👁️ [Phase Authorization] Can view "invoicing"?', 
        finalPermissions.find(p => p.phase_key === 'invoicing')?.can_view ?? false);
      
      setPhasePermissions(finalPermissions);
    } catch (error) {
      console.error('❌ [Phase Authorization] Error loading user data:', error);
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
