import { supabase } from "@/integrations/supabase/client";

export interface RateioProject {
  id: string;
  project_code: string;
  description: string;
  business_unit: string | null;
  management: string | null;
  business_area: string | null;
  is_active: boolean;
}

/**
 * Lookup a rateio project by code
 */
export async function lookupRateioProject(projectCode: string): Promise<RateioProject | null> {
  if (!projectCode) return null;
  
  const { data, error } = await supabase
    .from('rateio_projects')
    .select('*')
    .eq('project_code', projectCode.trim())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.log(`📋 Projeto RATEIO não encontrado: ${projectCode}`);
    return null;
  }

  console.log(`📋 Projeto RATEIO encontrado: ${projectCode} → ${data.description}`);
  return data as RateioProject;
}

/**
 * Get all active rateio projects
 */
export async function getAllRateioProjects(): Promise<RateioProject[]> {
  const { data, error } = await supabase
    .from('rateio_projects')
    .select('*')
    .eq('is_active', true)
    .order('project_code');

  if (error) {
    console.error('Erro ao buscar projetos RATEIO:', error);
    return [];
  }

  return (data || []) as RateioProject[];
}
