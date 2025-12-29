import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "./AuthContext";

// ============= Types =============

interface UserPhasePermission {
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

interface MenuPermission {
  menu_key: string;
  can_view: boolean;
}

// Chaves de menu disponíveis
export const ALL_MENU_KEYS = [
  'kanban',
  'metrics', 
  'producao',
  'files',
  'transportadoras',
  'carriers-chat',
  'compras',
  'technician-dispatches',
  'customers',
  'admin',
  'ai-agent',
  'settings'
] as const;

export type MenuKey = typeof ALL_MENU_KEYS[number];

// Roles com acesso total
const FULL_ACCESS_ROLES = ['admin'];

// ============= Context Type =============

interface PermissionsContextType {
  // User & Session (from AuthContext)
  user: User | null;
  session: Session | null;
  
  // Unified loading state
  loading: boolean;
  
  // Roles
  userRoles: string[];
  isAdmin: boolean;
  isApproved: boolean | null;
  
  // Role check functions
  hasRole: (role: string) => boolean;
  hasFullAccess: () => boolean;
  
  // Phase Permissions
  userPhasePermissions: UserPhasePermission[];
  canViewPhase: (phase: string) => boolean;
  canEditPhase: (phase: string) => boolean;
  canAdvancePhase: (phase: string) => boolean;
  canDeleteFromPhase: (phase: string) => boolean;
  
  // Menu Permissions
  menuPermissions: Record<string, boolean>;
  canViewMenu: (key: string) => boolean;
  
  // Actions
  refetch: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ============= Context =============

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// ============= Provider =============

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, session, loading: authLoading, signOut } = useAuthContext();
  
  // State
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [userPhasePermissions, setUserPhasePermissions] = useState<UserPhasePermission[]>([]);
  const [menuPermissions, setMenuPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Derived state
  const isAdmin = userRoles.includes('admin');

  // ============= Load all permissions in parallel =============
  const loadAllPermissions = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      setIsApproved(null);
      setUserPhasePermissions([]);
      setMenuPermissions({});
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 [PermissionsContext] Loading all permissions for user:', user.id);
      
      // Parallel queries
      const [rolesResult, approvalResult, phasePermsResult, menuPermsResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('user_approval_status').select('status').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_phase_permissions').select('*').eq('user_id', user.id),
        supabase.from('menu_permissions').select('menu_key, can_view').eq('user_id', user.id)
      ]);

      // Process roles
      const roles = rolesResult.data?.map((r: { role: string }) => r.role) || [];
      setUserRoles(roles);
      console.log('🔐 [PermissionsContext] User Roles:', roles);

      // Process approval status (users without record are considered approved - legacy)
      setIsApproved(approvalResult.data ? approvalResult.data.status === 'approved' : true);

      // Check if user has full access role
      const hasFullAccessRole = roles.some(role => FULL_ACCESS_ROLES.includes(role));

      // Process phase permissions
      if (hasFullAccessRole) {
        console.log('✅ [PermissionsContext] User has full access role');
        setUserPhasePermissions([]);
      } else {
        const phasePerms: UserPhasePermission[] = (phasePermsResult.data || []).map(p => ({
          phase_key: p.phase_key,
          can_view: p.can_view ?? false,
          can_edit: p.can_edit ?? false,
          can_advance: p.can_advance ?? false,
          can_delete: p.can_delete ?? false,
        }));
        setUserPhasePermissions(phasePerms);
        console.log('👤 [PermissionsContext] Phase permissions loaded:', phasePerms.length);
      }

      // Process menu permissions
      if (hasFullAccessRole) {
        // Admin sees everything
        const allVisible: Record<string, boolean> = {};
        ALL_MENU_KEYS.forEach(key => { allVisible[key] = true; });
        setMenuPermissions(allVisible);
      } else {
        // Default: all menus visible
        const perms: Record<string, boolean> = {};
        ALL_MENU_KEYS.forEach(key => { perms[key] = true; });
        
        // Apply explicit configurations
        (menuPermsResult.data || []).forEach((p: MenuPermission) => {
          perms[p.menu_key] = p.can_view;
        });
        
        setMenuPermissions(perms);
        console.log('📋 [PermissionsContext] Menu permissions loaded');
      }

    } catch (error) {
      console.error('❌ [PermissionsContext] Error loading permissions:', error);
      setUserRoles([]);
      setIsApproved(false);
      setUserPhasePermissions([]);
      // On error, allow all menus as fallback
      const allVisible: Record<string, boolean> = {};
      ALL_MENU_KEYS.forEach(key => { allVisible[key] = true; });
      setMenuPermissions(allVisible);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ============= Effect: Load on user change =============
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      setIsApproved(null);
      return;
    }

    loadAllPermissions();
  }, [user?.id, authLoading, loadAllPermissions]);

  // ============= Effect: Unified real-time subscription =============
  useEffect(() => {
    if (!user) return;

    console.log('📡 [PermissionsContext] Setting up unified real-time subscription');

    const channel = supabase
      .channel(`user-permissions-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_roles',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('🔄 [PermissionsContext] user_roles changed, reloading...');
        loadAllPermissions();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_phase_permissions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('🔄 [PermissionsContext] user_phase_permissions changed, reloading...');
        loadAllPermissions();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_permissions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('🔄 [PermissionsContext] menu_permissions changed, reloading...');
        loadAllPermissions();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_approval_status',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('🔄 [PermissionsContext] user_approval_status changed, reloading...');
        loadAllPermissions();
      })
      .subscribe();

    return () => {
      console.log('🔌 [PermissionsContext] Removing subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadAllPermissions]);

  // ============= Permission check functions =============

  const hasFullAccess = useCallback((): boolean => {
    return userRoles.some(role => FULL_ACCESS_ROLES.includes(role));
  }, [userRoles]);

  const hasRole = useCallback((role: string): boolean => {
    return userRoles.includes(role) || hasFullAccess();
  }, [userRoles, hasFullAccess]);

  const getEffectivePermission = useCallback((phase: string): UserPhasePermission | null => {
    return userPhasePermissions.find(p => p.phase_key === phase) || null;
  }, [userPhasePermissions]);

  const canViewPhase = useCallback((phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_view ?? false;
  }, [hasFullAccess, getEffectivePermission]);

  const canEditPhase = useCallback((phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_edit ?? false;
  }, [hasFullAccess, getEffectivePermission]);

  const canAdvancePhase = useCallback((phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_advance ?? false;
  }, [hasFullAccess, getEffectivePermission]);

  const canDeleteFromPhase = useCallback((phase: string): boolean => {
    if (hasFullAccess()) return true;
    const effective = getEffectivePermission(phase);
    return effective?.can_delete ?? false;
  }, [hasFullAccess, getEffectivePermission]);

  const canViewMenu = useCallback((key: string): boolean => {
    if (isAdmin) return true;
    return menuPermissions[key] ?? true;
  }, [menuPermissions, isAdmin]);

  // ============= Context value =============

  const value: PermissionsContextType = {
    // User & Session
    user,
    session,
    
    // Loading
    loading: loading || authLoading,
    
    // Roles
    userRoles,
    isAdmin,
    isApproved,
    
    // Role functions
    hasRole,
    hasFullAccess,
    
    // Phase permissions
    userPhasePermissions,
    canViewPhase,
    canEditPhase,
    canAdvancePhase,
    canDeleteFromPhase,
    
    // Menu permissions
    menuPermissions,
    canViewMenu,
    
    // Actions
    refetch: loadAllPermissions,
    signOut,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

// ============= Hook =============

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
