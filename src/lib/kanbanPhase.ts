/**
 * Helper compartilhado para mapear status → fase do Kanban
 * Usado tanto no KanbanView quanto no useDaysInPhase
 */

export type KanbanPhase = 
  | 'almox_ssm'
  | 'order_generation'
  | 'purchases'
  | 'almox_general'
  | 'production_client'
  | 'production_stock'
  | 'balance_generation'
  | 'laboratory'
  | 'packaging'
  | 'freight_quote'
  | 'ready_to_invoice'
  | 'invoicing'
  | 'logistics'
  | 'in_transit'
  | 'completion';

/**
 * Mapeia um status de pedido para sua fase do Kanban
 * @param status - Status atual do pedido
 * @param orderCategory - Categoria do pedido (vendas/estoque) - usado para diferenciar produção
 */
export function getPhaseFromStatus(status: string, orderCategory?: string): KanbanPhase {
  // Fase: Almox SSM
  if (['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'].includes(status)) {
    return 'almox_ssm';
  }
  
  // Fase: Gerar Ordem
  if (['order_generation_pending', 'order_in_creation', 'order_generated'].includes(status)) {
    return 'order_generation';
  }
  
  // Fase: Compras
  if (['purchase_pending', 'purchase_requested', 'purchase_in_progress', 'purchase_completed'].includes(status)) {
    return 'purchases';
  }
  
  // Fase: Almox Geral
  if (['almox_general_received', 'almox_general_separating', 'almox_general_ready'].includes(status)) {
    return 'almox_general';
  }
  
  // Fase: Produção - diferencia por categoria
  if (['separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed'].includes(status)) {
    return orderCategory === 'estoque' ? 'production_stock' : 'production_client';
  }
  
  // Fase: Gerar Saldo
  if (['balance_calculation', 'balance_review', 'balance_approved'].includes(status)) {
    return 'balance_generation';
  }
  
  // Fase: Laboratório
  if (['awaiting_lab', 'in_lab_analysis', 'lab_completed'].includes(status)) {
    return 'laboratory';
  }
  
  // Fase: Embalagem
  if (['in_quality_check', 'in_packaging', 'ready_for_shipping'].includes(status)) {
    return 'packaging';
  }
  
  // Fase: Cotação de Frete
  if (['freight_quote_requested', 'freight_quote_received', 'freight_approved'].includes(status)) {
    return 'freight_quote';
  }
  
  // Fase: À Faturar
  if (['ready_to_invoice', 'pending_invoice_request'].includes(status)) {
    return 'ready_to_invoice';
  }
  
  // Fase: Faturamento
  if (['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'].includes(status)) {
    return 'invoicing';
  }
  
  // Fase: Expedição
  if (['released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup'].includes(status)) {
    return 'logistics';
  }
  
  // Fase: Em Trânsito
  if (['in_transit', 'collected'].includes(status)) {
    return 'in_transit';
  }
  
  // Fase: Conclusão (fallback)
  return 'completion';
}

/**
 * Verifica se dois status pertencem à mesma fase
 */
export function isSamePhase(status1: string, status2: string, orderCategory?: string): boolean {
  return getPhaseFromStatus(status1, orderCategory) === getPhaseFromStatus(status2, orderCategory);
}
