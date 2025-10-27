import { supabase } from "@/integrations/supabase/client";

export interface OrderValidationData {
  orderNumber: string;
  totvsOrderNumber?: string;
  customerName: string;
  deliveryDate: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingOrder: any | null;
  duplicateType: 'totvs' | 'internal' | 'combined' | null;
}

/**
 * Verifica se um pedido já existe no sistema
 * 
 * Critérios de duplicação:
 * 1. TOTVS number já existe (prioritário)
 * 2. Order number + cliente + data próxima (±3 dias)
 */
export const checkForDuplicateOrder = async (
  data: OrderValidationData
): Promise<DuplicateCheckResult> => {
  try {
    // 1. Buscar por totvs_order_number (mais crítico)
    if (data.totvsOrderNumber) {
      const { data: existingByTotvs, error: totvsError } = await supabase
        .from('orders')
        .select('*')
        .eq('totvs_order_number', data.totvsOrderNumber)
        .not('status', 'in', '(cancelled,completed,delivered)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (totvsError) {
        console.error('Error checking TOTVS duplicate:', totvsError);
      }
      
      if (existingByTotvs) {
        return {
          isDuplicate: true,
          existingOrder: existingByTotvs,
          duplicateType: 'totvs'
        };
      }
    }
    
    // 2. Buscar por order_number + customer_name
    const { data: existingByOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', data.orderNumber)
      .ilike('customer_name', `%${data.customerName}%`)
      .not('status', 'in', '(cancelled,completed,delivered)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (orderError) {
      console.error('Error checking order duplicate:', orderError);
    }
    
    if (existingByOrder && existingByOrder.length > 0) {
      // Verificar diferença de datas (±3 dias)
      for (const existing of existingByOrder) {
        const existingDate = new Date(existing.delivery_date);
        const newDate = new Date(data.deliveryDate);
        const dateDiff = Math.abs(
          (existingDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (dateDiff <= 3) {
          return {
            isDuplicate: true,
            existingOrder: existing,
            duplicateType: 'combined'
          };
        }
      }
    }
    
    return { 
      isDuplicate: false, 
      existingOrder: null, 
      duplicateType: null 
    };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { 
      isDuplicate: false, 
      existingOrder: null, 
      duplicateType: null 
    };
  }
};
