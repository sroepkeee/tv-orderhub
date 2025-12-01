import { supabase } from "@/integrations/supabase/client";
import type { ParsedOrderData } from './excelParser';

export interface RateioProject {
  id: string;
  project_code: string;
  description: string;
  business_unit: string | null;
  management: string | null;
  business_area: string | null;
}

/**
 * Extract potential project codes from PDF order info
 * Looks for numeric codes in costCenter, accountItem, or notes
 */
function extractProjectCodes(orderInfo: ParsedOrderData['orderInfo']): string[] {
  const codes: string[] = [];
  
  // Check various fields for project codes (usually numeric)
  const fieldsToCheck = [
    orderInfo.costCenter,
    orderInfo.accountItem,
    orderInfo.businessUnit,
    orderInfo.notes,
    orderInfo.executiveName
  ];
  
  for (const field of fieldsToCheck) {
    if (!field) continue;
    
    // Look for standalone numbers that could be project codes
    const matches = field.match(/\b(\d{1,3})\b/g);
    if (matches) {
      codes.push(...matches);
    }
    
    // Look for patterns like "PROJETO 4" or "P-123"
    const projectMatches = field.match(/(?:PROJETO|PROJ|P[\-\s]?)(\d+)/gi);
    if (projectMatches) {
      for (const match of projectMatches) {
        const code = match.replace(/\D/g, '');
        if (code) codes.push(code);
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(codes)];
}

/**
 * Lookup rateio projects by codes
 */
async function lookupProjects(codes: string[]): Promise<RateioProject[]> {
  if (codes.length === 0) return [];
  
  const { data, error } = await supabase
    .from('rateio_projects')
    .select('*')
    .in('project_code', codes)
    .eq('is_active', true);

  if (error) {
    console.error('Erro ao buscar projetos RATEIO:', error);
    return [];
  }

  return (data || []) as RateioProject[];
}

/**
 * Enrich parsed order data with rateio project information
 * This looks up project codes in the rateio_projects table and fills in
 * business_unit and business_area if found
 */
export async function enrichWithRateioProject(
  parsedData: ParsedOrderData
): Promise<ParsedOrderData & { rateioProject?: RateioProject }> {
  console.log('🔍 Buscando projetos RATEIO para enriquecimento...');
  
  const orderInfo = parsedData.orderInfo;
  
  // Extract potential project codes from parsed data
  const potentialCodes = extractProjectCodes(orderInfo);
  console.log('📋 Códigos de projeto potenciais:', potentialCodes);
  
  if (potentialCodes.length === 0) {
    console.log('❌ Nenhum código de projeto encontrado no PDF');
    return parsedData;
  }
  
  // Lookup in database
  const projects = await lookupProjects(potentialCodes);
  
  if (projects.length === 0) {
    console.log('❌ Nenhum projeto encontrado na tabela rateio_projects');
    return parsedData;
  }
  
  // Use first match (typically there should only be one)
  const project = projects[0];
  console.log('✅ Projeto RATEIO encontrado:', project.project_code, '-', project.description);
  
  // Enrich order info with project data
  const enrichedOrderInfo = {
    ...orderInfo,
    // Override with rateio project data if available
    businessUnit: project.business_unit || orderInfo.businessUnit,
    businessArea: project.business_area || orderInfo.businessArea,
    // Store project code for reference
    rateioProjectCode: project.project_code
  };
  
  console.log('📊 Dados enriquecidos:', {
    businessUnit: enrichedOrderInfo.businessUnit,
    businessArea: enrichedOrderInfo.businessArea,
    projectCode: enrichedOrderInfo.rateioProjectCode
  });
  
  return {
    ...parsedData,
    orderInfo: enrichedOrderInfo,
    rateioProject: project
  };
}

/**
 * Get all active rateio projects for dropdown/reference
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
