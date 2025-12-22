import { useOrganization } from "./useOrganization";
import { toast } from "@/hooks/use-toast";

/**
 * Hook reutilizável para obter o organization_id do usuário atual.
 * Usa o contexto OrganizationProvider existente (sem queries extras).
 */
export function useOrganizationId() {
  const { membership, loading, hasOrganization } = useOrganization();
  
  const organizationId = membership?.organization_id ?? null;
  
  /**
   * Retorna o organization_id ou lança erro se não existir.
   * Útil para operações que requerem organização obrigatória.
   */
  const requireOrganization = (): string => {
    if (!organizationId) {
      toast({
        title: "Erro de organização",
        description: "Usuário não está vinculado a uma organização ativa",
        variant: "destructive"
      });
      throw new Error("Usuário não está vinculado a uma organização ativa");
    }
    return organizationId;
  };
  
  /**
   * Retorna o organization_id ou null se não existir.
   * Útil para verificações opcionais.
   */
  const getOrganizationId = (): string | null => {
    return organizationId;
  };
  
  return { 
    organizationId, 
    loading,
    hasOrganization,
    requireOrganization,
    getOrganizationId
  };
}
