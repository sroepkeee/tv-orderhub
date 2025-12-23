/**
 * Filtro LGPD para dados de pedidos
 * Remove informações sensíveis e estratégicas antes de enviar para clientes
 */

// Campos bloqueados para clientes
export const BLOCKED_FIELDS_FOR_CUSTOMERS = [
  // Dados de usuários internos
  'user_id',
  'created_by',
  'updated_by',
  'assigned_to',
  'executive_id',
  'executive_name',
  'sales_rep',
  
  // Dados contábeis/financeiros estratégicos
  'cost_center',
  'account_item',
  'business_area',
  'business_unit',
  'rateio_project_code',
  'operation_code',
  'profit_margin',
  
  // Valores unitários (mostrar apenas total)
  'unit_price',
  'discount_percent',
  'discount_value',
  
  // Tributação
  'ipi_percent',
  'icms_percent',
  'pis_percent',
  'cofins_percent',
  'tax_amount',
  
  // Dados internos de produção
  'production_released_by',
  'purchase_action_started_by',
  'priority_internal',
  'internal_notes',
  
  // Dados de compra/fornecedores
  'supplier_id',
  'supplier_name',
  'purchase_price',
  'purchase_order_number',
];

// Campos permitidos para clientes
export const ALLOWED_FIELDS_FOR_CUSTOMERS = [
  // Identificação
  'order_number',
  'totvs_order_number',
  
  // Status e datas
  'status',
  'current_phase',
  'delivery_date',
  'shipping_date',
  'created_at',
  
  // Cliente (só dele mesmo)
  'customer_name',
  'delivery_address',
  'delivery_city',
  'delivery_state',
  'delivery_zip',
  
  // Transporte
  'carrier_name',
  'tracking_code',
  'freight_type',
  'freight_modality',
  
  // Volumes/peso (informação de logística)
  'package_volumes',
  'package_weight_kg',
  'total_weight_kg',
  
  // Itens - apenas descrição e quantidade
  'item_description',
  'item_code',
  'requested_quantity',
  'delivered_quantity',
  
  // Valor total (se configurado para mostrar)
  'total_value', // Opcional - pode ser bloqueado também
];

/**
 * Filtra um objeto de pedido removendo campos sensíveis
 */
export function filterOrderForCustomer(order: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(order)) {
    // Pular campos bloqueados
    if (BLOCKED_FIELDS_FOR_CUSTOMERS.includes(key)) {
      continue;
    }
    
    // Pular campos que contenham dados sensíveis no nome
    if (
      key.toLowerCase().includes('internal') ||
      key.toLowerCase().includes('profit') ||
      key.toLowerCase().includes('margin') ||
      key.toLowerCase().includes('cost') ||
      key.toLowerCase().includes('_by') // created_by, updated_by, etc
    ) {
      continue;
    }
    
    // Se for array de itens, filtrar cada item
    if (Array.isArray(value) && key === 'order_items') {
      filtered[key] = value.map(item => filterOrderItemForCustomer(item));
      continue;
    }
    
    // Se for objeto aninhado, filtrar recursivamente
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      filtered[key] = filterOrderForCustomer(value);
      continue;
    }
    
    filtered[key] = value;
  }
  
  return filtered;
}

/**
 * Filtra um item de pedido removendo preços e informações internas
 */
export function filterOrderItemForCustomer(item: Record<string, any>): Record<string, any> {
  return {
    item_code: item.item_code,
    item_description: item.item_description,
    requested_quantity: item.requested_quantity,
    delivered_quantity: item.delivered_quantity,
    status: item.status,
    delivery_date: item.delivery_date,
    // Não incluir: unit_price, discount, etc
  };
}

/**
 * Gera um resumo seguro do pedido para o cliente
 */
export function generateCustomerOrderSummary(order: Record<string, any>, items: any[]): string {
  const filteredOrder = filterOrderForCustomer(order);
  
  const statusLabels: Record<string, string> = {
    'pending': 'Pendente',
    'in_transit': 'Em Trânsito',
    'delivered': 'Entregue',
    'collected': 'Coletado',
    'awaiting_pickup': 'Aguardando Coleta',
    'pickup_scheduled': 'Coleta Agendada',
    'in_expedition': 'Em Expedição',
    'released_for_shipping': 'Liberado para Envio',
    'ready_for_shipping': 'Pronto para Envio',
    'invoice_issued': 'Nota Fiscal Emitida',
    'separation_started': 'Separação Iniciada',
    'in_production': 'Em Produção',
    'production_completed': 'Produção Concluída',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
  };
  
  const status = statusLabels[filteredOrder.status] || filteredOrder.status;
  
  // Formatar itens (apenas descrição e quantidade)
  const itemsList = items.slice(0, 5).map(item => 
    `• ${item.requested_quantity}x ${item.item_description || item.item_code}`
  ).join('\n');
  
  const hasMoreItems = items.length > 5;
  
  // Formatar data
  const deliveryDate = filteredOrder.delivery_date 
    ? new Date(filteredOrder.delivery_date).toLocaleDateString('pt-BR')
    : 'A definir';
  
  return `📦 *Pedido #${filteredOrder.order_number}*
━━━━━━━━━━━━━━━━━━━━
📍 Status: *${status}*
📅 Previsão de entrega: ${deliveryDate}
🚚 Transportadora: ${filteredOrder.carrier_name || 'A definir'}
📋 Rastreio: ${filteredOrder.tracking_code || 'Aguardando'}

*ITENS DO PEDIDO:*
${itemsList}
${hasMoreItems ? `\n... e mais ${items.length - 5} item(s)` : ''}

${filteredOrder.package_weight_kg ? `📦 Peso total: ${filteredOrder.package_weight_kg} kg` : ''}
${filteredOrder.package_volumes ? `📦 Volumes: ${filteredOrder.package_volumes}` : ''}`;
}

/**
 * Verifica se uma mensagem contém solicitação de dados sensíveis
 */
export function containsSensitiveDataRequest(message: string): boolean {
  const sensitivePatterns = [
    /quanto\s*(custou|paguei|foi|é|era)/i,
    /valor\s*(unit[aá]rio|do\s*item|de\s*cada)/i,
    /pre[çc]o\s*(unit[aá]rio|de\s*custo)/i,
    /desconto/i,
    /margem/i,
    /lucro/i,
    /fornecedor/i,
    /supplier/i,
    /custo/i,
    /quem\s*vendeu/i,
    /vendedor/i,
    /comiss[ãa]o/i,
  ];
  
  return sensitivePatterns.some(p => p.test(message));
}

/**
 * Gera resposta padrão quando cliente pede dados sensíveis
 */
export function getSensitiveDataBlockedResponse(): string {
  return `Por questões de segurança e privacidade, algumas informações não podem ser compartilhadas por este canal.

Para detalhes sobre valores, notas fiscais ou informações comerciais, por favor entre em contato com nosso departamento comercial.

Posso ajudar com outras informações sobre seu pedido! 😊`;
}
