/**
 * Utilitário centralizado para labels e cores de status
 * Único ponto de verdade para mapeamento de status em toda aplicação
 */

export const STATUS_LABELS: Record<string, string> = {
  // Preparação/Planejamento
  "pending": "Pendente (Novo)",
  "almox_ssm_pending": "ALMOX SSM - Aguardando",
  "in_analysis": "Em Análise",
  "awaiting_approval": "Aguardando Aprovação",
  "planned": "Planejado",
  // Separação/Produção
  "separation_started": "Iniciado a Separação",
  "in_production": "Em Produção",
  "awaiting_material": "Aguardando Material",
  "separation_completed": "Concluído a Separação",
  "production_completed": "Concluído a Produção",
  // Embalagem/Conferência
  "in_quality_check": "Em Conferência/Qualidade",
  "in_packaging": "Em Embalagem",
  "ready_for_shipping": "Pronto para Envio",
  // Cotação de Frete
  "freight_quote_requested": "Cotação Solicitada",
  "freight_quote_received": "Cotação Recebida",
  "freight_approved": "Frete Aprovado",
  // Expedição/Logística
  "released_for_shipping": "Liberado para Envio",
  "in_expedition": "Deixado na Expedição",
  "in_transit": "Em Trânsito",
  "pickup_scheduled": "Retirada Agendada",
  "awaiting_pickup": "Aguardando Retirada",
  "collected": "Coletado",
  // À Faturar (Nova Fase)
  "ready_to_invoice": "Pronto para Faturar",
  "pending_invoice_request": "Aguardando Solicitação",
  // Faturamento Solicitado
  "invoice_requested": "Faturamento Solicitado",
  "awaiting_invoice": "Processando Faturamento",
  "invoice_issued": "Nota Fiscal Emitida",
  "invoice_sent": "NF Enviada ao Cliente",
  // Conclusão
  "delivered": "Entregue",
  "completed": "Concluído",
  // Exceção/Problemas
  "cancelled": "Cancelado",
  "on_hold": "Em Espera",
  "delayed": "Atrasado",
  "returned": "Devolvido",
  // Itens/Estoque/Almoxarifado
  "in_stock": "Em estoque",
  "almox_ssm_received": "Recebido no Almox (SSM)",
  "almox_general_received": "Recebido no Almox (Geral)",
  // Status de itens (item_status)
  "awaiting_production": "Aguardando Produção",
  "purchase_required": "Solicitar Compra",
  "purchase_requested": "Solicitado Compra"
};

/**
 * Retorna o label amigável para um status
 * @param status - Código do status (ex: "freight_approved")
 * @returns Label amigável (ex: "Frete Aprovado") ou o status original se não encontrado
 */
export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '(vazio)';
  return STATUS_LABELS[status] || status;
}

/**
 * Retorna classes de cor para um status específico
 * @param status - Código do status
 * @returns Classes Tailwind de cor
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Verde - Concluído/Sucesso
    "completed": "bg-green-500",
    "delivered": "bg-green-600",
    "production_completed": "bg-green-500",
    "separation_completed": "bg-green-500",
    "invoice_issued": "bg-green-500",
    "collected": "bg-green-600",
    // Azul - Em andamento
    "in_production": "bg-blue-500",
    "in_transit": "bg-blue-500",
    "in_packaging": "bg-blue-500",
    "in_quality_check": "bg-blue-500",
    "separation_started": "bg-blue-400",
    // Amarelo - Aguardando/Planejado
    "pending": "bg-yellow-500",
    "planned": "bg-yellow-500",
    "awaiting_approval": "bg-yellow-500",
    "awaiting_material": "bg-yellow-500",
    "awaiting_pickup": "bg-yellow-500",
    "invoice_requested": "bg-yellow-500",
    "awaiting_invoice": "bg-yellow-500",
    "freight_quote_requested": "bg-yellow-500",
    // Laranja - Atenção
    "on_hold": "bg-orange-500",
    "delayed": "bg-orange-500",
    "freight_quote_received": "bg-orange-400",
    "purchase_required": "bg-orange-500",
    // Roxo - Aprovado/Especial
    "freight_approved": "bg-purple-500",
    "ready_for_shipping": "bg-purple-500",
    "purchase_requested": "bg-purple-500",
    // Teal - À Faturar
    "ready_to_invoice": "bg-teal-500",
    "pending_invoice_request": "bg-teal-400",
    // Vermelho - Cancelado/Problema
    "cancelled": "bg-red-500",
    "returned": "bg-red-500",
    // Cinza - Outros
    "in_analysis": "bg-gray-500"
  };
  
  return colors[status] || "bg-gray-500";
}
