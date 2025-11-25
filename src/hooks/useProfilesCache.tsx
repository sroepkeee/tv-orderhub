import { supabase } from "@/integrations/supabase/client";

// Cache global de profiles para evitar queries repetidas
const profilesCache = new Map<string, { full_name: string; email: string }>();

export const useProfilesCache = () => {
  const getProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return [];
    
    // Filtrar IDs que ainda não estão em cache
    const uncachedIds = userIds.filter(id => !profilesCache.has(id));
    
    // Buscar apenas profiles que não estão em cache
    if (uncachedIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uncachedIds);
        
      // Adicionar ao cache
      data?.forEach(p => profilesCache.set(p.id, p));
    }
    
    // Retornar profiles do cache
    return userIds.map(id => profilesCache.get(id)).filter(Boolean);
  };
  
  const getProfile = async (userId: string) => {
    if (!userId) return null;
    const profiles = await getProfiles([userId]);
    return profiles[0] || null;
  };
  
  return { getProfiles, getProfile };
};
