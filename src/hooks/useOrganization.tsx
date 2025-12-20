import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_limits: unknown;
  is_active: boolean;
  settings: unknown;
  logo_url?: string | null;
  trial_ends_at?: string;
  created_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  membership: OrganizationMember | null;
  loading: boolean;
  hasOrganization: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  createOrganization: (name: string, slug: string) => Promise<string | null>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganization = async () => {
    if (!user) {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    try {
      // Buscar membership do usuário
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (memberError) {
        console.error('Error fetching membership:', memberError);
        setLoading(false);
        return;
      }

      if (!memberData) {
        // Usuário não tem organização
        setOrganization(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      setMembership(memberData as OrganizationMember);

      // Buscar dados da organização
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', memberData.organization_id)
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        setLoading(false);
        return;
      }

      setOrganization(orgData as Organization);
    } catch (error) {
      console.error('Error in fetchOrganization:', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (name: string, slug: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Usar a função RPC que cria org com defaults
      const { data, error } = await supabase.rpc('create_organization_with_defaults', {
        _org_name: name,
        _slug: slug,
        _owner_user_id: user.id,
        _plan: 'starter'
      });

      if (error) {
        console.error('Error creating organization:', error);
        throw error;
      }

      // Refetch para atualizar o estado
      await fetchOrganization();
      
      return data as string;
    } catch (error) {
      console.error('Error in createOrganization:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, [user]);

  const value: OrganizationContextType = {
    organization,
    membership,
    loading,
    hasOrganization: !!organization,
    isOwner: membership?.role === 'owner',
    isAdmin: membership?.role === 'owner' || membership?.role === 'admin',
    refetch: fetchOrganization,
    createOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

// Hook simples para usar fora do provider
export function useCurrentOrganization() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setOrganizationId(data?.organization_id || null);
      setLoading(false);
    };

    fetchOrgId();
  }, []);

  return { organizationId, loading };
}
