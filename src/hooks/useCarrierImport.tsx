import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedCarrierData } from '@/lib/carrierExcelParser';
import { toast } from 'sonner';

export interface ImportResult {
  success: boolean;
  carrierName: string;
  error?: string;
}

export const useCarrierImport = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkDuplicates = async (carriers: ParsedCarrierData[]) => {
    // Get all existing carriers
    const { data: existingCarriers } = await supabase
      .from('carriers')
      .select('name, cnpj, email')
      .eq('is_active', true);

    if (!existingCarriers) return [];

    const duplicates: Array<{ carrier: ParsedCarrierData; reason: string }> = [];

    carriers.forEach(carrier => {
      // Check by CNPJ (if provided)
      if (carrier.cnpj) {
        const cnpjDuplicate = existingCarriers.find(
          existing => existing.cnpj === carrier.cnpj
        );
        if (cnpjDuplicate) {
          duplicates.push({
            carrier,
            reason: `CNPJ já cadastrado (${cnpjDuplicate.name})`
          });
          return;
        }
      }

      // Check by name + email
      const nameDuplicate = existingCarriers.find(
        existing => existing.name.toLowerCase() === carrier.name.toLowerCase()
      );
      if (nameDuplicate) {
        duplicates.push({
          carrier,
          reason: `Nome já cadastrado (${nameDuplicate.email})`
        });
        return;
      }

      const emailDuplicate = existingCarriers.find(
        existing => existing.email.toLowerCase() === carrier.email.toLowerCase()
      );
      if (emailDuplicate) {
        duplicates.push({
          carrier,
          reason: `Email já cadastrado (${emailDuplicate.name})`
        });
      }
    });

    return duplicates;
  };

  const importCarriers = async (carriers: ParsedCarrierData[]): Promise<ImportResult[]> => {
    setLoading(true);
    setProgress(0);
    const results: ImportResult[] = [];

    try {
      // Check for duplicates
      const duplicates = await checkDuplicates(carriers);
      
      if (duplicates.length > 0) {
        duplicates.forEach(dup => {
          results.push({
            success: false,
            carrierName: dup.carrier.name,
            error: dup.reason
          });
        });
        
        toast.warning(`${duplicates.length} duplicatas encontradas e não serão importadas`);
      }

      // Filter out duplicates
      const duplicateNames = new Set(duplicates.map(d => d.carrier.name));
      const carriersToImport = carriers.filter(c => !duplicateNames.has(c.name));

      // Import carriers one by one to track progress
      for (let i = 0; i < carriersToImport.length; i++) {
        const carrier = carriersToImport[i];
        
        try {
          const { error } = await supabase
            .from('carriers')
            .insert([{
              name: carrier.name,
              cnpj: carrier.cnpj || null,
              email: carrier.email,
              quote_email: carrier.quote_email || null,
              collection_email: carrier.collection_email || null,
              whatsapp: carrier.whatsapp || null,
              phone: carrier.phone || null,
              contact_person: carrier.contact_person,
              contact_position: carrier.contact_position || null,
              additional_contacts: carrier.additional_contacts as any,
              service_states: carrier.service_states,
              coverage_notes: carrier.coverage_notes || null,
              notes: carrier.notes || null,
              is_active: true
            }]);

          if (error) throw error;

          results.push({
            success: true,
            carrierName: carrier.name
          });
        } catch (error: any) {
          results.push({
            success: false,
            carrierName: carrier.name,
            error: error.message
          });
        }

        setProgress(Math.round(((i + 1) / carriersToImport.length) * 100));
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} transportadora(s) importada(s) com sucesso!`);
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} erro(s) durante a importação`);
      }

    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }

    return results;
  };

  return {
    importCarriers,
    loading,
    progress
  };
};
