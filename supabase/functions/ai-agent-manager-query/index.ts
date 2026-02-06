import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-internal-source',
};

// Validar requisição - aceita API Key ou origem interna
function validateRequest(req: Request): boolean {
  // Opção 1: API Key válida
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  const expectedKey = Deno.env.get('N8N_API_KEY');
  if (expectedKey && apiKey === expectedKey) {
    return true;
  }
  
  // Opção 2: Chamada interna do mega-api-webhook
  const internalSource = req.headers.get('x-internal-source');
  if (internalSource === 'mega-api-webhook') {
    return true;
  }
  
  return false;
}

interface QueryIntent {
  type: 'order_status' | 'daily_summary' | 'delayed_orders' | 'orders_by_phase' | 'top_orders' | 
        'search_customer' | 'help' | 'general' | 'rateio' | 'volumes' | 'cotacoes' | 
        'historico' | 'anexos' | 'metricas' | 'tendencia' | 'gargalos' | 'transportadora' | 'alertas' |
        'item_details' | 'overdue_items' | 'stuck_items' |
        // Novos comandos avançados
        'value_by_phase' | 'lead_time' | 'top_customers' | 'risk_forecast' | 
        'capacity_analysis' | 'carrier_performance' | 'freight_cost' | 'destination_analysis' |
        'critical_items' | 'pending_materials' | 'weekend_deliveries';
  params: Record<string, any>;
}

// Helper para mapear status para nome da fase
function getPhaseFromStatus(status: string): string {
  const phaseMap: Record<string, string> = {
    'almox_ssm_pending': 'Almox SSM', 'almox_ssm_received': 'Almox SSM',
    'order_generation_pending': 'Gerar Ordem', 'order_in_creation': 'Gerar Ordem', 'order_generated': 'Gerar Ordem',
    'almox_general_separating': 'Almox Geral', 'almox_general_ready': 'Almox Geral', 'almox_general_received': 'Almox Geral',
    'purchase_pending': 'Compras', 'purchase_quoted': 'Compras', 'purchase_ordered': 'Compras', 'purchase_received': 'Compras',
    'pending': 'Produção', 'in_production': 'Produção', 'separation_started': 'Produção', 'awaiting_material': 'Produção', 'separation_completed': 'Produção', 'production_completed': 'Produção',
    'balance_calculation': 'Gerar Saldo', 'balance_review': 'Gerar Saldo', 'balance_approved': 'Gerar Saldo',
    'awaiting_lab': 'Laboratório', 'in_lab_analysis': 'Laboratório', 'lab_completed': 'Laboratório',
    'in_quality_check': 'Embalagem', 'in_packaging': 'Embalagem', 'ready_for_shipping': 'Embalagem',
    'freight_quote_requested': 'Cotação', 'freight_quote_received': 'Cotação', 'freight_approved': 'Cotação',
    'ready_to_invoice': 'À Faturar', 'pending_invoice_request': 'À Faturar',
    'invoice_requested': 'Faturamento', 'awaiting_invoice': 'Faturamento', 'invoice_issued': 'Faturamento', 'invoice_sent': 'Faturamento',
    'released_for_shipping': 'Expedição', 'in_expedition': 'Expedição', 'pickup_scheduled': 'Expedição', 'awaiting_pickup': 'Expedição',
    'in_transit': 'Transporte', 'collected': 'Transporte',
  };
  return phaseMap[status] || 'Outros';
}

// Fuzzy matching para correção de typos comuns
function fuzzyMatch(input: string): string {
  const corrections: Record<string, string> = {
    'starus': 'status', 'stauts': 'status', 'statsu': 'status', 'estatus': 'status',
    'rsumo': 'resumo', 'resumoo': 'resumo', 'reusmo': 'resumo', 'resmo': 'resumo',
    'atrazados': 'atrasados', 'atrazado': 'atrasado', 'atrasaods': 'atrasados',
    'produçao': 'produção', 'producao': 'produção', 'produçã': 'produção',
    'embalage': 'embalagem', 'embalgen': 'embalagem',
    'faturamneto': 'faturamento', 'faturament': 'faturamento',
    'laboratorio': 'laboratório', 'laboratori': 'laboratório',
    'expediçao': 'expedição', 'expedicao': 'expedição',
    'metricas': 'métricas', 'metrica': 'métricas',
    'tendencia': 'tendência', 'tendenci': 'tendência',
    'cotaçao': 'cotação', 'cotacao': 'cotação',
  };
  
  let result = input;
  for (const [wrong, correct] of Object.entries(corrections)) {
    result = result.replace(new RegExp(wrong, 'gi'), correct);
  }
  return result;
}

// ==================== ROBUST ORDER SEARCH ====================

// Normalizar número do pedido - remove caracteres não numéricos e espaços
function normalizeOrderNumber(orderNumber: string): string {
  // Remove espaços, caracteres invisíveis e mantém apenas dígitos
  return orderNumber.replace(/[\s\u00A0\u200B\u200C\u200D\uFEFF]/g, '').replace(/\D/g, '');
}

// Busca robusta de pedido por número - tenta múltiplas estratégias
async function findOrderByNumber(supabase: any, orderNumber: string, selectFields: string = '*'): Promise<any | null> {
  const normalized = normalizeOrderNumber(orderNumber);
  
  if (!normalized) {
    console.log('⚠️ findOrderByNumber: Empty order number after normalization');
    return null;
  }
  
  console.log(`🔍 findOrderByNumber: Searching for "${orderNumber}" (normalized: "${normalized}")`);
  
  // Estratégia 1: Match exato em order_number
  let { data: order } = await supabase
    .from('orders')
    .select(selectFields)
    .eq('order_number', normalized)
    .limit(1)
    .maybeSingle();
  
  if (order) {
    console.log(`✅ Found via exact order_number: ${order.order_number}`);
    return order;
  }
  
  // Estratégia 2: Match exato em totvs_order_number
  ({ data: order } = await supabase
    .from('orders')
    .select(selectFields)
    .eq('totvs_order_number', normalized)
    .limit(1)
    .maybeSingle());
  
  if (order) {
    console.log(`✅ Found via exact totvs_order_number: ${order.order_number}`);
    return order;
  }
  
  // Estratégia 3: ILIKE em order_number (contém)
  ({ data: order } = await supabase
    .from('orders')
    .select(selectFields)
    .ilike('order_number', `%${normalized}%`)
    .limit(1)
    .maybeSingle());
  
  if (order) {
    console.log(`✅ Found via ilike order_number: ${order.order_number}`);
    return order;
  }
  
  // Estratégia 4: ILIKE em totvs_order_number
  ({ data: order } = await supabase
    .from('orders')
    .select(selectFields)
    .ilike('totvs_order_number', `%${normalized}%`)
    .limit(1)
    .maybeSingle());
  
  if (order) {
    console.log(`✅ Found via ilike totvs_order_number: ${order.order_number}`);
    return order;
  }
  
  // Estratégia 5: Remover zeros à esquerda
  const withoutLeadingZeros = normalized.replace(/^0+/, '');
  if (withoutLeadingZeros && withoutLeadingZeros !== normalized) {
    ({ data: order } = await supabase
      .from('orders')
      .select(selectFields)
      .or(`order_number.ilike.%${withoutLeadingZeros}%,totvs_order_number.ilike.%${withoutLeadingZeros}%`)
      .limit(1)
      .maybeSingle());
    
    if (order) {
      console.log(`✅ Found via without leading zeros: ${order.order_number}`);
      return order;
    }
  }
  
  // Estratégia 6: Adicionar zeros à esquerda (para números TOTVS que usam padding)
  const with6Digits = normalized.padStart(6, '0');
  const with8Digits = normalized.padStart(8, '0');
  
  if (with6Digits !== normalized || with8Digits !== normalized) {
    ({ data: order } = await supabase
      .from('orders')
      .select(selectFields)
      .or(`order_number.eq.${with6Digits},order_number.eq.${with8Digits},totvs_order_number.eq.${with6Digits},totvs_order_number.eq.${with8Digits}`)
      .limit(1)
      .maybeSingle());
    
    if (order) {
      console.log(`✅ Found via padded number: ${order.order_number}`);
      return order;
    }
  }
  
  console.log(`❌ Order not found after all strategies: "${orderNumber}"`);
  return null;
}

// ==================== LEARNING FEEDBACK INSTRUMENTATION ====================

// Detectar gaps de conhecimento baseado na resposta
function detectKnowledgeGaps(intentType: string, response: string, originalMessage: string): string[] {
  const gaps: string[] = [];
  
  // Se a resposta indica que não encontrou algo
  if (response.includes('❌') && response.includes('não encontr')) {
    if (intentType === 'order_status') {
      gaps.push('order_lookup_failed');
    } else if (intentType === 'item_details') {
      gaps.push('item_lookup_failed');
    } else if (intentType === 'search_customer') {
      gaps.push('customer_search_failed');
    } else if (intentType === 'transportadora') {
      gaps.push('carrier_search_failed');
    } else {
      gaps.push('general_lookup_failed');
    }
  }
  
  // Se caiu no tipo 'general', pode indicar falta de comando
  if (intentType === 'general') {
    gaps.push('unknown_command');
    
    // Detectar possíveis intenções não mapeadas
    const msgLower = originalMessage.toLowerCase();
    if (msgLower.includes('cancel') || msgLower.includes('cancelar')) {
      gaps.push('missing_cancellation_command');
    }
    if (msgLower.includes('priorid') || msgLower.includes('urgent')) {
      gaps.push('missing_priority_command');
    }
    if (msgLower.includes('retrabalho') || msgLower.includes('refaz')) {
      gaps.push('missing_rework_command');
    }
  }
  
  return gaps;
}

// Inferir sentimento básico da mensagem
function inferSentiment(message: string): 'positive' | 'neutral' | 'negative' {
  const msgLower = message.toLowerCase();
  
  const negativeWords = ['problema', 'erro', 'urgente', 'atrasado', 'falta', 'errado', 'ruim', 'péssimo', 'absurdo'];
  const positiveWords = ['ok', 'obrigado', 'ótimo', 'perfeito', 'bom', 'excelente', 'parabéns'];
  
  const hasNegative = negativeWords.some(w => msgLower.includes(w));
  const hasPositive = positiveWords.some(w => msgLower.includes(w));
  
  if (hasNegative && !hasPositive) return 'negative';
  if (hasPositive && !hasNegative) return 'positive';
  return 'neutral';
}

// Registrar feedback de aprendizado
async function recordLearningFeedback(
  supabase: any,
  params: {
    message: string;
    response: string;
    intentType: string;
    responseTimeMs: number;
    carrierId?: string;
    agentInstanceId?: string;
  }
): Promise<void> {
  try {
    const gaps = detectKnowledgeGaps(params.intentType, params.response, params.message);
    const sentiment = inferSentiment(params.message);
    
    // Determinar status de resolução
    const hasError = params.response.includes('❌') || params.response.includes('não encontr');
    const resolutionStatus = hasError ? 'failed' : 'resolved';
    
    // Calcular confiança (maior se foi um comando bem definido)
    const isWellDefinedCommand = !['general', 'help'].includes(params.intentType);
    const confidenceScore = isWellDefinedCommand ? 0.9 : 0.5;
    
    // Inserir feedback
    const { error } = await supabase
      .from('ai_learning_feedback')
      .insert({
        agent_instance_id: params.agentInstanceId || null,
        message_content: params.message.substring(0, 1000),
        response_content: params.response.substring(0, 2000),
        confidence_score: confidenceScore,
        resolution_status: resolutionStatus,
        response_time_ms: params.responseTimeMs,
        knowledge_gaps_detected: gaps.length > 0 ? gaps : null,
        customer_sentiment: sentiment,
        feedback_source: 'manager_query',
        feedback_notes: `Intent: ${params.intentType}`,
      });
    
    if (error) {
      console.error('⚠️ Failed to record learning feedback:', error.message);
    } else {
      console.log(`📊 Learning feedback recorded: ${resolutionStatus}, gaps: ${gaps.join(',') || 'none'}`);
    }
    
    // Se há gaps, criar sugestão de conhecimento
    if (gaps.length > 0 && hasError) {
      await supabase
        .from('ai_knowledge_suggestions')
        .insert({
          agent_instance_id: params.agentInstanceId || null,
          suggestion_type: 'gap_detected',
          suggested_title: `Melhoria: ${gaps[0].replace(/_/g, ' ')}`,
          suggested_content: `Comando original: "${params.message}"\nResposta: "${params.response.substring(0, 200)}..."\nSugestão: Adicionar tratamento para este tipo de consulta.`,
          suggested_category: 'Erros',
          suggested_keywords: gaps,
          source_question: params.message.substring(0, 500),
          detection_reason: `Gap detectado: ${gaps.join(', ')}`,
          confidence_score: 0.7,
          status: 'pending',
        });
      
      console.log(`💡 Knowledge suggestion created for gap: ${gaps[0]}`);
    }
  } catch (err) {
    // Não propagar erro - feedback é secundário
    console.error('⚠️ Exception in recordLearningFeedback:', err);
  }
}

// Mensagem amigável quando pedido não é encontrado
function getOrderNotFoundMessage(orderNumber: string): string {
  const normalized = normalizeOrderNumber(orderNumber);
  return `❌ Não encontrei o pedido *#${normalized || orderNumber}*.

💡 *Dicas:*
• Verifique se o número está correto
• Tente apenas os dígitos (ex: \`status 140037\`)
• O pedido pode ser IMPLY ou TOTVS - ambos são buscados automaticamente

📋 Comandos úteis:
• \`resumo\` - ver todos os pedidos ativos
• \`cliente <nome>\` - buscar pedidos de um cliente`;
}

// Detectar intenção da mensagem do gestor
function detectManagerIntent(message: string): QueryIntent {
  const correctedMessage = fuzzyMatch(message);
  const messageLower = correctedMessage.toLowerCase().trim();

  // ===================== COMANDOS AVANÇADOS DE ANÁLISE =====================
  
  // Valor por fase
  if (messageLower.includes('valor por fase') || messageLower.includes('valor fase') || 
      messageLower.includes('distribuição valor') || messageLower.includes('value by phase')) {
    return { type: 'value_by_phase', params: {} };
  }

  // Lead time
  if (messageLower.includes('lead time') || messageLower.includes('tempo ciclo') || 
      messageLower.includes('tempo médio') || messageLower.includes('cycle time')) {
    return { type: 'lead_time', params: {} };
  }

  // Top clientes
  if (messageLower.includes('top clientes') || messageLower.includes('maiores clientes') || 
      messageLower.includes('ranking clientes') || messageLower.includes('clientes valor')) {
    return { type: 'top_customers', params: { limit: 10 } };
  }

  // Risco semana / previsão
  if (messageLower.includes('risco semana') || messageLower.includes('previsão atraso') || 
      messageLower.includes('risk forecast') || messageLower.includes('vão atrasar')) {
    return { type: 'risk_forecast', params: {} };
  }

  // Capacidade
  if (messageLower.includes('capacidade') || messageLower.includes('carga fase') || 
      messageLower.includes('capacity') || messageLower.includes('sobrecarga')) {
    return { type: 'capacity_analysis', params: {} };
  }

  // Performance transportadoras
  if (messageLower.includes('performance transportadora') || messageLower.includes('ranking transportadora') ||
      messageLower.includes('melhor transportadora') || messageLower.includes('carrier performance')) {
    return { type: 'carrier_performance', params: {} };
  }

  // Custo frete
  if (messageLower.includes('custo frete') || messageLower.includes('frete médio') || 
      messageLower.includes('freight cost') || messageLower.includes('análise frete')) {
    return { type: 'freight_cost', params: {} };
  }

  // Destinos / geografia
  if (messageLower.includes('destinos') || messageLower.includes('geografia') || 
      messageLower.includes('regiões') || messageLower.includes('concentração')) {
    return { type: 'destination_analysis', params: {} };
  }

  // Itens críticos (importados, urgentes)
  if (messageLower.includes('itens críticos') || messageLower.includes('itens importados') || 
      messageLower.includes('itens urgentes') || messageLower.includes('critical items')) {
    return { type: 'critical_items', params: {} };
  }

  // Materiais pendentes
  if (messageLower.includes('materiais pendentes') || messageLower.includes('pendente compra') || 
      messageLower.includes('aguardando material') || messageLower.includes('pending materials')) {
    return { type: 'pending_materials', params: {} };
  }

  // Entregas fim de semana
  if (messageLower.includes('fim de semana') || messageLower.includes('weekend') || 
      messageLower.includes('entrega sábado') || messageLower.includes('entrega domingo')) {
    return { type: 'weekend_deliveries', params: {} };
  }

  // ===================== COMANDOS DE ITENS =====================
  
  // Item específico: "item 1234567" ou "código 1234567"
  const itemMatch = messageLower.match(/(?:item|código|codigo|cod)\s*#?\s*([a-zA-Z0-9\-]+)/i);
  if (itemMatch) {
    return { type: 'item_details', params: { itemCode: itemMatch[1] } };
  }

  // Itens com SLA vencido
  if (messageLower.includes('itens atrasados') || messageLower.includes('itens vencidos') || 
      messageLower.includes('sla vencido') || messageLower.includes('itens overdue')) {
    return { type: 'overdue_items', params: {} };
  }

  // Itens parados/travados
  if ((messageLower.includes('itens') || messageLower.includes('item')) && 
      (messageLower.includes('parado') || messageLower.includes('travado') || messageLower.includes('stuck'))) {
    return { type: 'stuck_items', params: {} };
  }

  // ===================== FIM NOVOS COMANDOS =====================

  // Rateio
  const rateioMatch = messageLower.match(/(?:rateio|projeto)\s*#?\s*(\d+)/i);
  if (rateioMatch || messageLower.includes('rateio')) {
    return { type: 'rateio', params: { projectCode: rateioMatch?.[1] || '' } };
  }

  // Volumes
  const volumesMatch = messageLower.match(/(?:volumes?|dimensões?|peso)\s*(?:do\s+)?(?:pedido\s+)?#?\s*(\d+)/i);
  if (volumesMatch) {
    return { type: 'volumes', params: { orderNumber: volumesMatch[1] } };
  }

  // Cotações de frete
  const cotacoesMatch = messageLower.match(/(?:cotaç[ãõo]es?|frete|freight)\s*(?:do\s+)?(?:pedido\s+)?#?\s*(\d+)/i);
  if (cotacoesMatch) {
    return { type: 'cotacoes', params: { orderNumber: cotacoesMatch[1] } };
  }

  // Histórico
  const historicoMatch = messageLower.match(/(?:histórico|historico|timeline|alterações)\s*(?:do\s+)?(?:pedido\s+)?#?\s*(\d+)/i);
  if (historicoMatch) {
    return { type: 'historico', params: { orderNumber: historicoMatch[1] } };
  }

  // Anexos
  const anexosMatch = messageLower.match(/(?:anexos?|arquivos?|documentos?)\s*(?:do\s+)?(?:pedido\s+)?#?\s*(\d+)/i);
  if (anexosMatch) {
    return { type: 'anexos', params: { orderNumber: anexosMatch[1] } };
  }

  // Métricas/SLA
  if (messageLower.includes('métricas') || messageLower.includes('metricas') || 
      messageLower.includes('sla') || messageLower.includes('performance') ||
      messageLower.includes('indicador')) {
    return { type: 'metricas', params: {} };
  }

  // Tendência
  if (messageLower.includes('tendência') || messageLower.includes('tendencia') || 
      messageLower.includes('comparativo') || messageLower.includes('semana')) {
    return { type: 'tendencia', params: {} };
  }

  // Gargalos
  if (messageLower.includes('gargalo') || messageLower.includes('bottleneck') || 
      messageLower.includes('problema') || messageLower.includes('travado') ||
      messageLower.includes('parado') || messageLower.includes('engarrafado')) {
    return { type: 'gargalos', params: {} };
  }

  // Transportadora
  const transportadoraMatch = messageLower.match(/(?:transportadora|carrier)\s+(.+)/i);
  if (transportadoraMatch) {
    return { type: 'transportadora', params: { carrierName: transportadoraMatch[1].trim() } };
  }

  // Alertas
  if (messageLower.includes('alertas') || messageLower.includes('pendências') || 
      messageLower.includes('urgente') || messageLower.includes('crítico')) {
    return { type: 'alertas', params: {} };
  }

  // Status de pedido específico
  const orderMatch = messageLower.match(/(?:status|pedido|order)\s*#?\s*(\d+)/i) ||
                     messageLower.match(/#?\s*(\d+)\s*(?:status)?/i);
  if (orderMatch) {
    return { type: 'order_status', params: { orderNumber: orderMatch[1] } };
  }

  // Resumo do dia
  if (messageLower.includes('resumo') || messageLower.includes('dashboard') || 
      messageLower.includes('hoje') || messageLower.includes('visão geral') ||
      messageLower === 'dia' || messageLower === 'status' || messageLower === 'geral') {
    return { type: 'daily_summary', params: {} };
  }

  // Pedidos atrasados
  if (messageLower.includes('atrasad') || messageLower.includes('atraso') || 
      messageLower.includes('delay') || messageLower.includes('vencid')) {
    return { type: 'delayed_orders', params: {} };
  }

  // Pedidos por fase - ATUALIZADO COM TODAS AS FASES
  const phaseKeywords: Record<string, string[]> = {
    // Almox SSM
    'almox_ssm': ['almox ssm', 'ssm', 'almoxarifado ssm', 'recebimento ssm'],
    // Gerar Ordem
    'order_generation': ['gerar ordem', 'ordem', 'geração', 'criação ordem', 'gerando ordem'],
    // Almox Geral  
    'almox_general': ['almox geral', 'almoxarifado geral', 'separação almox'],
    // Compras
    'purchases': ['compra', 'compras', 'suprimentos', 'suprimento', 'purchase', 'pendente compra'],
    // Produção
    'production_client': ['produção', 'producao', 'em produção', 'em producao', 'production', 'separação'],
    // Gerar Saldo
    'balance': ['saldo', 'gerar saldo', 'cálculo saldo'],
    // Laboratório
    'laboratory': ['laboratório', 'laboratorio', 'lab', 'análise lab'],
    // Embalagem
    'packaging': ['embalagem', 'embalando', 'packaging', 'conferência', 'qualidade'],
    // Cotação de Frete
    'freight_quote': ['cotação frete', 'frete solicitado', 'cotação pendente', 'cotação'],
    // À Faturar
    'ready_to_invoice': ['à faturar', 'a faturar', 'pronto faturar', 'pronto para faturar', 'aguardando fatura'],
    // Faturamento Solicitado
    'invoicing': ['faturamento', 'faturar', 'fatura', 'nf', 'nota fiscal', 'invoice', 'nf solicitada'],
    // Expedição
    'logistics': ['expedição', 'expedicao', 'logística', 'logistica', 'logistics', 'envio'],
    // Em Trânsito
    'in_transit': ['trânsito', 'transito', 'em transporte', 'in_transit', 'viagem', 'entrega'],
  };

  for (const [phase, keywords] of Object.entries(phaseKeywords)) {
    if (keywords.some(kw => messageLower.includes(kw))) {
      return { type: 'orders_by_phase', params: { phase } };
    }
  }

  // Top pedidos por valor
  if (messageLower.includes('maior') || messageLower.includes('top') || 
      messageLower.includes('valor') || messageLower.includes('grandes')) {
    return { type: 'top_orders', params: { limit: 5 } };
  }

  // Buscar cliente
  const customerMatch = messageLower.match(/(?:cliente|customer)\s+(.+)/i);
  if (customerMatch) {
    return { type: 'search_customer', params: { customerName: customerMatch[1].trim() } };
  }

  // Ajuda
  if (messageLower.includes('ajuda') || messageLower.includes('help') || 
      messageLower === 'comandos' || messageLower === '?') {
    return { type: 'help', params: {} };
  }

  return { type: 'general', params: { query: message } };
}

// ==================== NOVAS FUNÇÕES ====================

// Buscar projeto de rateio
async function getRateioProject(supabase: any, projectCode: string): Promise<string> {
  if (!projectCode) {
    // Listar projetos recentes
    const { data: projects } = await supabase
      .from('rateio_projects')
      .select('*')
      .eq('is_active', true)
      .order('project_code')
      .limit(10);

    if (!projects || projects.length === 0) {
      return '❌ Nenhum projeto de rateio encontrado.';
    }

    let response = `📋 *Projetos de Rateio Ativos*
━━━━━━━━━━━━━━━━━━`;

    projects.forEach((p: any) => {
      response += `\n\n📁 *${p.project_code}*
   ${p.description}
   🏢 UN: ${p.business_unit || 'N/A'} | Gestão: ${p.management || 'N/A'}`;
    });

    return response;
  }

  const { data: project } = await supabase
    .from('rateio_projects')
    .select('*')
    .eq('project_code', projectCode)
    .maybeSingle();

  if (!project) {
    return `❌ Projeto de rateio "${projectCode}" não encontrado.`;
  }

  return `📋 *Projeto de Rateio: ${project.project_code}*
━━━━━━━━━━━━━━━━━━
📝 Descrição: ${project.description}
🏢 Unidade de Negócio: ${project.business_unit || 'N/A'}
👤 Gestão: ${project.management || 'N/A'}
🏷️ Área de Negócio: ${project.business_area || 'N/A'}
✅ Status: ${project.is_active ? 'Ativo' : 'Inativo'}`;
}

// Buscar volumes de um pedido
async function getOrderVolumes(supabase: any, orderNumber: string): Promise<string> {
  // Usar busca robusta
  const order = await findOrderByNumber(supabase, orderNumber, 'id, order_number, customer_name');

  if (!order) {
    return getOrderNotFoundMessage(orderNumber);
  }

  const { data: volumes } = await supabase
    .from('order_volumes')
    .select('*')
    .eq('order_id', order.id)
    .order('volume_number');

  if (!volumes || volumes.length === 0) {
    return `📦 Pedido *#${order.order_number}* não possui volumes cadastrados.`;
  }

  let totalWeight = 0;
  let totalCubicWeight = 0;

  let response = `📦 *Volumes do Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📦 Total de Volumes: ${volumes.length}

*Detalhes:*`;

  volumes.forEach((v: any) => {
    const cubicWeight = v.cubic_weight || 0;
    const realWeight = v.weight || 0;
    totalWeight += realWeight;
    totalCubicWeight += cubicWeight;

    response += `\n\n📦 *Volume ${v.volume_number}*
   📐 ${v.length || 0}x${v.width || 0}x${v.height || 0} cm
   ⚖️ Peso: ${realWeight.toFixed(2)} kg
   📊 Cubagem: ${cubicWeight.toFixed(2)} kg`;
  });

  response += `\n\n━━━━━━━━━━━━━━━━━━
⚖️ *Peso Total:* ${totalWeight.toFixed(2)} kg
📊 *Cubagem Total:* ${totalCubicWeight.toFixed(2)} kg
📦 *Peso Tarifado:* ${Math.max(totalWeight, totalCubicWeight).toFixed(2)} kg`;

  return response;
}

// Buscar cotações de frete
async function getFreightQuotes(supabase: any, orderNumber: string): Promise<string> {
  // Usar busca robusta
  const order = await findOrderByNumber(supabase, orderNumber, 'id, order_number, customer_name, municipality, delivery_address');

  if (!order) {
    return getOrderNotFoundMessage(orderNumber);
  }

  const { data: quotes } = await supabase
    .from('freight_quotes')
    .select(`
      *,
      carriers(name),
      freight_quote_responses(*)
    `)
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  if (!quotes || quotes.length === 0) {
    return `💰 Pedido *#${order.order_number}* não possui cotações de frete.`;
  }

  let response = `💰 *Cotações de Frete - #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📍 Destino: ${order.municipality || 'N/A'}
📋 Cotações: ${quotes.length}`;

  quotes.forEach((q: any, idx: number) => {
    const carrier = q.carriers?.name || 'N/A';
    const status = q.status === 'approved' ? '✅ Aprovada' : 
                   q.status === 'pending' ? '⏳ Pendente' : 
                   q.status === 'expired' ? '⏰ Expirada' : q.status;
    
    const responses = q.freight_quote_responses || [];
    const selectedResponse = responses.find((r: any) => r.is_selected);

    response += `\n\n${idx + 1}️⃣ *${carrier}*
   📍 Status: ${status}
   📅 Solicitada: ${new Date(q.created_at).toLocaleDateString('pt-BR')}`;

    if (selectedResponse) {
      response += `\n   💰 Valor: R$ ${Number(selectedResponse.freight_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   ⏱️ Prazo: ${selectedResponse.delivery_time_days || 'N/A'} dias`;
    } else if (responses.length > 0) {
      const minValue = Math.min(...responses.map((r: any) => r.freight_value || Infinity));
      response += `\n   💰 Menor valor: R$ ${minValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  });

  return response;
}

// Buscar histórico de alterações
async function getOrderHistory(supabase: any, orderNumber: string): Promise<string> {
  // Usar busca robusta
  const order = await findOrderByNumber(supabase, orderNumber, 'id, order_number, customer_name, created_at');

  if (!order) {
    return getOrderNotFoundMessage(orderNumber);
  }

  // Buscar alterações de data
  const { data: dateChanges } = await supabase
    .from('delivery_date_changes')
    .select('*, profiles:changed_by(full_name)')
    .eq('order_id', order.id)
    .order('changed_at', { ascending: false })
    .limit(10);

  // Buscar histórico de status
  const { data: statusHistory } = await supabase
    .from('order_history')
    .select('*, profiles:changed_by(full_name)')
    .eq('order_id', order.id)
    .order('changed_at', { ascending: false })
    .limit(10);

  let response = `📜 *Histórico - Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📅 Criado em: ${new Date(order.created_at).toLocaleDateString('pt-BR')}`;

  if (dateChanges && dateChanges.length > 0) {
    response += `\n\n📅 *Alterações de Data (${dateChanges.length}):*`;
    dateChanges.slice(0, 5).forEach((change: any) => {
      const oldDate = new Date(change.old_date).toLocaleDateString('pt-BR');
      const newDate = new Date(change.new_date).toLocaleDateString('pt-BR');
      const changedBy = change.profiles?.full_name || 'Sistema';
      response += `\n• ${oldDate} → ${newDate}
   👤 Por: ${changedBy}
   📝 ${change.reason || 'Sem motivo informado'}`;
    });
  }

  if (statusHistory && statusHistory.length > 0) {
    response += `\n\n🔄 *Alterações de Status (${statusHistory.length}):*`;
    statusHistory.slice(0, 5).forEach((change: any) => {
      const date = new Date(change.changed_at).toLocaleDateString('pt-BR');
      response += `\n• ${change.old_status} → ${change.new_status}
   📅 ${date}`;
    });
  }

  if ((!dateChanges || dateChanges.length === 0) && (!statusHistory || statusHistory.length === 0)) {
    response += `\n\n_Sem alterações registradas._`;
  }

  return response;
}

// Listar anexos
async function getOrderAttachments(supabase: any, orderNumber: string): Promise<string> {
  // Usar busca robusta
  const order = await findOrderByNumber(supabase, orderNumber, 'id, order_number, customer_name');

  if (!order) {
    return getOrderNotFoundMessage(orderNumber);
  }

  const { data: attachments } = await supabase
    .from('order_attachments')
    .select('*')
    .eq('order_id', order.id)
    .order('uploaded_at', { ascending: false });

  if (!attachments || attachments.length === 0) {
    return `📎 Pedido *#${order.order_number}* não possui anexos.`;
  }

  let response = `📎 *Anexos - Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📁 Total de Arquivos: ${attachments.length}`;

  attachments.forEach((att: any, idx: number) => {
    const size = att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : 'N/A';
    const date = new Date(att.uploaded_at).toLocaleDateString('pt-BR');
    const icon = att.file_type?.includes('pdf') ? '📄' : 
                 att.file_type?.includes('image') ? '🖼️' : 
                 att.file_type?.includes('excel') || att.file_type?.includes('sheet') ? '📊' : '📁';

    response += `\n\n${idx + 1}. ${icon} *${att.file_name}*
   📏 ${size} | 📅 ${date}`;
  });

  return response;
}

// Calcular métricas de SLA
async function getSLAMetrics(supabase: any): Promise<string> {
  const today = new Date();
  
  // Buscar pedidos ativos com itens para calcular valor
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, delivery_date, created_at, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  
  // Função para calcular valor de um pedido somando seus itens
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };
  
  const totalValue = activeOrders.reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);

  // Calcular métricas
  let onTime = 0;
  let late = 0;
  let critical = 0;
  let lateValue = 0;

  activeOrders.forEach((order: any) => {
    if (!order.delivery_date) return;
    const deliveryDate = new Date(order.delivery_date);
    const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const orderValue = calcOrderValue(order);

    if (daysUntil < 0) {
      late++;
      lateValue += orderValue;
    } else if (daysUntil <= 2) {
      critical++;
    } else {
      onTime++;
    }
  });

  // Calcular tempo médio por fase
  const phaseCount: Record<string, { count: number; totalDays: number }> = {};
  const phaseMap: Record<string, string> = {
    // Almox SSM
    'almox_ssm_pending': 'Almox SSM',
    'almox_ssm_received': 'Almox SSM',
    // Gerar Ordem
    'order_generation_pending': 'Gerar Ordem',
    'order_in_creation': 'Gerar Ordem',
    'order_generated': 'Gerar Ordem',
    // Almox Geral
    'almox_general_separating': 'Almox Geral',
    'almox_general_ready': 'Almox Geral',
    'almox_general_received': 'Almox Geral',
    // Compras
    'purchase_pending': 'Compras',
    'purchase_quoted': 'Compras',
    'purchase_ordered': 'Compras',
    'purchase_received': 'Compras',
    // Produção
    'pending': 'Produção',
    'in_production': 'Produção',
    'separation_started': 'Produção',
    'awaiting_material': 'Produção',
    'separation_completed': 'Produção',
    'production_completed': 'Produção',
    // Gerar Saldo
    'balance_calculation': 'Gerar Saldo',
    'balance_review': 'Gerar Saldo',
    'balance_approved': 'Gerar Saldo',
    // Laboratório
    'awaiting_lab': 'Laboratório',
    'in_lab_analysis': 'Laboratório',
    'lab_completed': 'Laboratório',
    // Embalagem
    'in_quality_check': 'Embalagem',
    'in_packaging': 'Embalagem',
    'ready_for_shipping': 'Embalagem',
    // Cotação de Frete
    'freight_quote_requested': 'Cotação',
    'freight_quote_received': 'Cotação',
    'freight_approved': 'Cotação',
    // À Faturar
    'ready_to_invoice': 'À Faturar',
    'pending_invoice_request': 'À Faturar',
    // Faturamento
    'invoice_requested': 'Faturamento',
    'awaiting_invoice': 'Faturamento',
    'invoice_issued': 'Faturamento',
    'invoice_sent': 'Faturamento',
    // Expedição
    'released_for_shipping': 'Expedição',
    'in_expedition': 'Expedição',
    'pickup_scheduled': 'Expedição',
    'awaiting_pickup': 'Expedição',
    // Em Trânsito
    'in_transit': 'Transporte',
    'collected': 'Transporte',
  };

  activeOrders.forEach((order: any) => {
    const phase = phaseMap[order.status] || 'Outros';
    const createdAt = new Date(order.created_at);
    const daysInPhase = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (!phaseCount[phase]) {
      phaseCount[phase] = { count: 0, totalDays: 0 };
    }
    phaseCount[phase].count++;
    phaseCount[phase].totalDays += daysInPhase;
  });

  const onTimeRate = activeOrders.length > 0 
    ? Math.round((onTime / activeOrders.length) * 100) 
    : 100;

  let response = `📊 *Métricas de Performance*
━━━━━━━━━━━━━━━━━━

📈 *SLA Geral:*
• Taxa no prazo: *${onTimeRate}%*
• Pedidos ativos: ${activeOrders.length}
• No prazo: ${onTime} ✅
• Críticos (<3 dias): ${critical} ⚠️
• Atrasados: ${late} 🔴

💰 *Valor em Risco:*
• Atrasados: R$ ${lateValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
• Total ativo: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

⏱️ *Qtd por Fase:*`;

  Object.entries(phaseCount)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([phase, data]) => {
      const avgDays = data.count > 0 ? (data.totalDays / data.count).toFixed(1) : 0;
      const emoji = phase === 'Produção' ? '🔧' : 
                    phase === 'Embalagem' ? '📦' : 
                    phase === 'Transporte' ? '🚛' :
                    phase === 'Laboratório' ? '🔬' :
                    phase === 'Faturamento' ? '💳' :
                    phase === 'Expedição' ? '📤' : '📋';
      response += `\n${emoji} ${phase}: ${data.count} (~${avgDays} dias)`;
    });

  return response;
}

// Análise de tendência semanal
async function getWeeklyTrend(supabase: any): Promise<string> {
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Pedidos criados esta semana com itens para calcular valor
  const { data: thisWeekCreated } = await supabase
    .from('orders')
    .select('id, order_items(total_value, unit_price, requested_quantity)')
    .gte('created_at', lastWeek.toISOString());

  // Pedidos criados semana passada
  const { data: lastWeekCreated } = await supabase
    .from('orders')
    .select('id, order_items(total_value, unit_price, requested_quantity)')
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', lastWeek.toISOString());

  // Pedidos entregues esta semana
  const { data: thisWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'delivered')
    .gte('updated_at', lastWeek.toISOString());

  // Pedidos entregues semana passada
  const { data: lastWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'delivered')
    .gte('updated_at', twoWeeksAgo.toISOString())
    .lt('updated_at', lastWeek.toISOString());

  const thisWeekCount = thisWeekCreated?.length || 0;
  const lastWeekCount = lastWeekCreated?.length || 0;
  const thisWeekDeliveredCount = thisWeekDelivered?.length || 0;
  const lastWeekDeliveredCount = lastWeekDelivered?.length || 0;

  // Calcular valor somando order_items
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  const thisWeekValue = (thisWeekCreated || []).reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);
  const lastWeekValue = (lastWeekCreated || []).reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);

  // Calcular variações
  const createdChange = lastWeekCount > 0 
    ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) 
    : 0;
  const deliveredChange = lastWeekDeliveredCount > 0 
    ? Math.round(((thisWeekDeliveredCount - lastWeekDeliveredCount) / lastWeekDeliveredCount) * 100) 
    : 0;
  const valueChange = lastWeekValue > 0 
    ? Math.round(((thisWeekValue - lastWeekValue) / lastWeekValue) * 100) 
    : 0;

  const createdTrend = createdChange > 0 ? `📈 +${createdChange}%` : createdChange < 0 ? `📉 ${createdChange}%` : '➡️ 0%';
  const deliveredTrend = deliveredChange > 0 ? `📈 +${deliveredChange}%` : deliveredChange < 0 ? `📉 ${deliveredChange}%` : '➡️ 0%';
  const valueTrend = valueChange > 0 ? `📈 +${valueChange}%` : valueChange < 0 ? `📉 ${valueChange}%` : '➡️ 0%';

  return `📈 *Tendência Semanal*
━━━━━━━━━━━━━━━━━━
📅 Período: Últimos 7 dias vs anterior

📦 *Pedidos Criados:*
• Esta semana: ${thisWeekCount}
• Semana anterior: ${lastWeekCount}
• Variação: ${createdTrend}

✅ *Pedidos Entregues:*
• Esta semana: ${thisWeekDeliveredCount}
• Semana anterior: ${lastWeekDeliveredCount}
• Variação: ${deliveredTrend}

💰 *Valor dos Novos Pedidos:*
• Esta semana: R$ ${thisWeekValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
• Semana anterior: R$ ${lastWeekValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
• Variação: ${valueTrend}`;
}

// Análise de gargalos
async function getBottleneckAnalysis(supabase: any): Promise<string> {
  const today = new Date();

  // Buscar pedidos ativos com tempo em cada fase
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, updated_at')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const phaseThresholds: Record<string, number> = {
    'Almox SSM': 2,
    'Gerar Ordem': 2,
    'Almox Geral': 2,
    'Compras': 7,
    'Produção': 7,
    'Gerar Saldo': 1,
    'Laboratório': 3,
    'Embalagem': 2,
    'Cotação': 3,
    'À Faturar': 1,
    'Faturamento': 2,
    'Expedição': 2,
    'Transporte': 5,
  };

  const phaseMap: Record<string, string> = {
    // Almox SSM
    'almox_ssm_pending': 'Almox SSM',
    'almox_ssm_received': 'Almox SSM',
    // Gerar Ordem
    'order_generation_pending': 'Gerar Ordem',
    'order_in_creation': 'Gerar Ordem',
    'order_generated': 'Gerar Ordem',
    // Almox Geral
    'almox_general_separating': 'Almox Geral',
    'almox_general_ready': 'Almox Geral',
    'almox_general_received': 'Almox Geral',
    // Compras
    'purchase_pending': 'Compras',
    'purchase_quoted': 'Compras',
    'purchase_ordered': 'Compras',
    'purchase_received': 'Compras',
    // Produção
    'pending': 'Produção',
    'in_production': 'Produção',
    'separation_started': 'Produção',
    'awaiting_material': 'Produção',
    'separation_completed': 'Produção',
    'production_completed': 'Produção',
    // Gerar Saldo
    'balance_calculation': 'Gerar Saldo',
    'balance_review': 'Gerar Saldo',
    'balance_approved': 'Gerar Saldo',
    // Laboratório
    'awaiting_lab': 'Laboratório',
    'in_lab_analysis': 'Laboratório',
    'lab_completed': 'Laboratório',
    // Embalagem
    'in_quality_check': 'Embalagem',
    'in_packaging': 'Embalagem',
    'ready_for_shipping': 'Embalagem',
    // Cotação de Frete
    'freight_quote_requested': 'Cotação',
    'freight_quote_received': 'Cotação',
    'freight_approved': 'Cotação',
    // À Faturar
    'ready_to_invoice': 'À Faturar',
    'pending_invoice_request': 'À Faturar',
    // Faturamento
    'invoice_requested': 'Faturamento',
    'awaiting_invoice': 'Faturamento',
    'invoice_issued': 'Faturamento',
    'invoice_sent': 'Faturamento',
    // Expedição
    'released_for_shipping': 'Expedição',
    'in_expedition': 'Expedição',
    'pickup_scheduled': 'Expedição',
    'awaiting_pickup': 'Expedição',
    // Em Trânsito
    'in_transit': 'Transporte',
    'collected': 'Transporte',
  };

  const bottlenecks: Array<{ phase: string; count: number; avgDays: number; threshold: number; orders: any[] }> = [];
  const phaseData: Record<string, { orders: any[]; totalDays: number }> = {};

  (orders || []).forEach((order: any) => {
    const phase = phaseMap[order.status] || 'Outros';
    const updatedAt = new Date(order.updated_at || order.created_at);
    const daysInPhase = Math.ceil((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (!phaseData[phase]) {
      phaseData[phase] = { orders: [], totalDays: 0 };
    }
    phaseData[phase].orders.push({ ...order, daysInPhase });
    phaseData[phase].totalDays += daysInPhase;
  });

  Object.entries(phaseData).forEach(([phase, data]) => {
    const threshold = phaseThresholds[phase] || 5;
    const avgDays = data.orders.length > 0 ? data.totalDays / data.orders.length : 0;
    const stuckOrders = data.orders.filter(o => o.daysInPhase > threshold);

    if (stuckOrders.length > 0 || avgDays > threshold) {
      bottlenecks.push({
        phase,
        count: stuckOrders.length,
        avgDays,
        threshold,
        orders: stuckOrders.slice(0, 3),
      });
    }
  });

  if (bottlenecks.length === 0) {
    return `✅ *Análise de Gargalos*
━━━━━━━━━━━━━━━━━━

🎉 Nenhum gargalo identificado!
Todas as fases estão dentro dos limites esperados.`;
  }

  // Ordenar por severidade
  bottlenecks.sort((a, b) => b.count - a.count);

  let response = `⚠️ *Análise de Gargalos*
━━━━━━━━━━━━━━━━━━
🔍 ${bottlenecks.length} fase(s) com problemas identificados`;

  bottlenecks.forEach((b, idx) => {
    const severity = b.avgDays > b.threshold * 2 ? '🔴' : b.avgDays > b.threshold ? '🟡' : '🟢';
    const emoji = b.phase === 'Produção' ? '🔧' : 
                  b.phase === 'Embalagem' ? '📦' : 
                  b.phase === 'Laboratório' ? '🔬' :
                  b.phase === 'Faturamento' ? '💳' :
                  b.phase === 'Cotação' ? '💰' :
                  b.phase === 'Expedição' ? '📤' : '📋';

    response += `\n\n${severity} *${emoji} ${b.phase}*
• ${b.count} pedidos acima do limite
• Média: ${b.avgDays.toFixed(1)} dias (limite: ${b.threshold})`;

    if (b.orders.length > 0) {
      response += `\n• Pedidos travados:`;
      b.orders.forEach((o: any) => {
        response += `\n  - #${o.order_number || o.id?.substring(0, 8) || 'N/A'} (${o.daysInPhase}d)`;
      });
    }
  });

  return response;
}

// Buscar por transportadora
async function getCarrierOrders(supabase: any, carrierName: string): Promise<string> {
  const { data: carriers } = await supabase
    .from('carriers')
    .select('id, name')
    .ilike('name', `%${carrierName}%`)
    .limit(5);

  if (!carriers || carriers.length === 0) {
    return `❌ Transportadora "${carrierName}" não encontrada.`;
  }

  const carrier = carriers[0];
  
  const { data: quotes } = await supabase
    .from('freight_quotes')
    .select(`
      *,
      orders(order_number, customer_name, status, destination_city)
    `)
    .eq('carrier_id', carrier.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!quotes || quotes.length === 0) {
    return `🚛 Transportadora *${carrier.name}* não possui cotações recentes.`;
  }

  let response = `🚛 *Cotações - ${carrier.name}*
━━━━━━━━━━━━━━━━━━
📋 Total: ${quotes.length} cotações recentes`;

  const statusCount = { pending: 0, approved: 0, expired: 0 };
  
  quotes.forEach((q: any) => {
    if (q.status === 'pending') statusCount.pending++;
    else if (q.status === 'approved') statusCount.approved++;
    else if (q.status === 'expired') statusCount.expired++;
  });

  response += `\n\n📊 *Resumo:*
• Pendentes: ${statusCount.pending}
• Aprovadas: ${statusCount.approved}
• Expiradas: ${statusCount.expired}

📦 *Últimas Cotações:*`;

  quotes.slice(0, 5).forEach((q: any, idx: number) => {
    const order = q.orders;
    const status = q.status === 'approved' ? '✅' : q.status === 'pending' ? '⏳' : '⏰';
    response += `\n\n${idx + 1}. ${status} *#${order?.order_number || 'N/A'}*
   👤 ${order?.customer_name?.substring(0, 20) || 'N/A'}
   📍 ${order?.destination_city || 'N/A'}`;
  });

  return response;
}

// Listar alertas pendentes
async function getPendingAlerts(supabase: any): Promise<string> {
  const today = new Date();
  const alerts: string[] = [];

  // Pedidos atrasados
  const { data: delayedOrders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, total_value, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .lt('delivery_date', today.toISOString().split('T')[0])
    .limit(5);

  if (delayedOrders && delayedOrders.length > 0) {
    alerts.push(`🔴 *${delayedOrders.length} pedidos atrasados*`);
    delayedOrders.slice(0, 3).forEach((o: any) => {
      alerts.push(`   • #${o.order_number} - ${o.customer_name.substring(0, 15)}`);
    });
  }

  // Pedidos com SLA crítico (vence em 24h)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const { data: criticalOrders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .gte('delivery_date', today.toISOString().split('T')[0])
    .lte('delivery_date', tomorrow.toISOString().split('T')[0])
    .limit(5);

  if (criticalOrders && criticalOrders.length > 0) {
    alerts.push(`\n🟡 *${criticalOrders.length} pedidos críticos (24h)*`);
    criticalOrders.slice(0, 3).forEach((o: any) => {
      alerts.push(`   • #${o.order_number} - ${o.customer_name.substring(0, 15)}`);
    });
  }

  // Cotações pendentes > 48h
  const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);
  const { data: pendingQuotes } = await supabase
    .from('freight_quotes')
    .select('id, orders(order_number)')
    .eq('status', 'pending')
    .lt('created_at', twoDaysAgo.toISOString())
    .limit(5);

  if (pendingQuotes && pendingQuotes.length > 0) {
    alerts.push(`\n💰 *${pendingQuotes.length} cotações sem resposta (>48h)*`);
  }

  // Pedidos aguardando material > 3 dias
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const { data: awaitingMaterial } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('status', 'awaiting_material')
    .lt('updated_at', threeDaysAgo.toISOString())
    .limit(5);

  if (awaitingMaterial && awaitingMaterial.length > 0) {
    alerts.push(`\n🔧 *${awaitingMaterial.length} aguardando material (>3 dias)*`);
  }

  if (alerts.length === 0) {
    return `✅ *Alertas Pendentes*
━━━━━━━━━━━━━━━━━━

🎉 Nenhum alerta no momento!
Todos os indicadores estão normais.`;
  }

  return `⚠️ *Alertas Pendentes*
━━━━━━━━━━━━━━━━━━

${alerts.join('\n')}

💡 _Use "atrasados" ou "métricas" para mais detalhes._`;
}

// ==================== FUNÇÕES EXISTENTES ====================

// Buscar detalhes de um pedido específico
async function getOrderDetails(supabase: any, orderNumber: string): Promise<string> {
  // Usar busca robusta que tenta múltiplas estratégias
  const order = await findOrderByNumber(
    supabase, 
    orderNumber,
    `id, order_number, customer_name, status, delivery_date, 
     notes, created_at, updated_at, freight_type, delivery_address, municipality,
     order_items(id, item_code, item_description, requested_quantity, delivered_quantity, item_status, delivery_date, unit_price, total_value)`
  );

  if (!order) {
    return getOrderNotFoundMessage(orderNumber);
  }

  const items = order.order_items || [];
  const itemsCount = items.length;
  const today = new Date();
  
  // Calcular valor total dos itens
  const calculatedValue = items.reduce((sum: number, item: any) => {
    const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
    return sum + Number(itemValue);
  }, 0);
  const totalValue = calculatedValue > 0 ? `R$ ${calculatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado';
  
  const deliveryDate = order.delivery_date ? new Date(order.delivery_date) : null;
  const daysUntilDelivery = deliveryDate ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  // Calcular tempo na fase atual (usando updated_at como proxy para início da fase)
  const orderUpdatedAt = new Date(order.updated_at || order.created_at);
  const daysInCurrentPhase = Math.ceil((today.getTime() - orderUpdatedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  let slaStatus = '⏳';
  if (daysUntilDelivery !== null) {
    if (daysUntilDelivery < 0) slaStatus = '🔴 Atrasado';
    else if (daysUntilDelivery === 0) slaStatus = '🟡 Vence hoje';
    else if (daysUntilDelivery <= 2) slaStatus = '🟡 Crítico';
    else slaStatus = '🟢 No prazo';
  }

  const statusLabels: Record<string, string> = {
    // Almox SSM
    'almox_ssm_pending': '📥 Aguardando SSM',
    'almox_ssm_received': '✅ Recebido SSM',
    // Gerar Ordem
    'order_generation_pending': '📝 Pendente Ordem',
    'order_in_creation': '📝 Criando Ordem',
    'order_generated': '✅ Ordem Gerada',
    // Almox Geral
    'almox_general_separating': '📦 Separando',
    'almox_general_ready': '✅ Pronto Almox',
    'almox_general_received': '📥 Recebido Almox',
    // Compras
    'purchase_pending': '🛒 Pendente Compra',
    'purchase_quoted': '💰 Cotação Recebida',
    'purchase_ordered': '📋 Pedido Emitido',
    'purchase_received': '✅ Material Recebido',
    // Produção
    'pending': '⏳ Pendente',
    'in_production': '🔧 Em Produção',
    'separation_started': '📦 Separação Iniciada',
    'awaiting_material': '⏳ Aguardando Material',
    'separation_completed': '✅ Separação Concluída',
    'production_completed': '✅ Produção Concluída',
    // Gerar Saldo
    'balance_calculation': '🧮 Calculando Saldo',
    'balance_review': '🔍 Revisando Saldo',
    'balance_approved': '✅ Saldo Aprovado',
    // Laboratório
    'awaiting_lab': '🔬 Aguardando Lab',
    'in_lab_analysis': '🔬 Em Análise Lab',
    'lab_completed': '✅ Lab Concluído',
    // Embalagem
    'in_quality_check': '🔍 Em Conferência',
    'in_packaging': '📦 Em Embalagem',
    'ready_for_shipping': '🚚 Pronto para Envio',
    // Cotação de Frete
    'freight_quote_requested': '💰 Cotação Solicitada',
    'freight_quote_received': '💰 Cotação Recebida',
    'freight_approved': '✅ Frete Aprovado',
    // À Faturar
    'ready_to_invoice': '💳 Pronto para Faturar',
    'pending_invoice_request': '⏳ Aguardando Solicitação',
    // Faturamento
    'invoice_requested': '💳 NF Solicitada',
    'awaiting_invoice': '⏳ Processando NF',
    'invoice_issued': '✅ NF Emitida',
    'invoice_sent': '✅ NF Enviada',
    // Expedição
    'released_for_shipping': '📤 Liberado Envio',
    'in_expedition': '📤 Na Expedição',
    'pickup_scheduled': '📅 Retirada Agendada',
    'awaiting_pickup': '⏳ Aguardando Retirada',
    // Em Trânsito
    'in_transit': '🚛 Em Trânsito',
    'collected': '✅ Coletado',
    // Conclusão
    'delivered': '✅ Entregue',
    'completed': '✅ Concluído',
  };

  const statusText = statusLabels[order.status] || order.status;
  const currentPhase = getPhaseFromStatus(order.status);

  let response = `📦 *Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📍 Status: ${statusText}
🏷️ Fase: ${currentPhase} (${daysInCurrentPhase}d na fase)
📅 Previsão: ${deliveryDate ? deliveryDate.toLocaleDateString('pt-BR') : 'Não definida'}
💰 Valor: ${totalValue}
${slaStatus}

📋 *Itens (${itemsCount}):*`;

  // Mostrar itens com mais detalhes incluindo tempo na fase e valor
  items.slice(0, 5).forEach((item: any) => {
    const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
    const itemPhaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at || order.created_at);
    const itemDaysInPhase = Math.ceil((today.getTime() - itemPhaseStarted.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calcular SLA do item
    let itemSlaIcon = '⚪';
    if (item.sla_deadline) {
      const slaDate = new Date(item.sla_deadline);
      const daysToSla = Math.ceil((slaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToSla < 0) itemSlaIcon = '🔴';
      else if (daysToSla <= 2) itemSlaIcon = '🟡';
      else itemSlaIcon = '🟢';
    }
    
    response += `\n${itemSlaIcon} ${item.requested_quantity}x ${item.item_code}`;
    if (item.item_description) {
      response += `\n   📦 ${item.item_description.substring(0, 25)}`;
    }
    response += `\n   💰 R$ ${Number(itemValue).toLocaleString('pt-BR')} | ⏱️ ${itemDaysInPhase}d na fase`;
  });

  if (items.length > 5) {
    response += `\n... e mais ${items.length - 5} itens`;
  }

  if (order.destination_city) {
    response += `\n\n🚚 Destino: ${order.destination_city}${order.destination_state ? `/${order.destination_state}` : ''}`;
  }

  if (order.freight_type) {
    response += `\n📦 Frete: ${order.freight_type}`;
  }

  return response;
}

// ==================== NOVAS FUNÇÕES DE ITENS ====================

// Buscar detalhes de um item específico
async function getItemDetails(supabase: any, itemCode: string): Promise<string> {
  const today = new Date();
  
  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id, item_code, item_description, requested_quantity, delivered_quantity, 
      item_status, unit_price, total_value, delivery_date, sla_deadline, sla_days,
      current_phase, phase_started_at, item_source_type, created_at,
      orders(id, order_number, customer_name, status, delivery_date)
    `)
    .ilike('item_code', `%${itemCode}%`)
    .limit(5);

  if (!items || items.length === 0) {
    return `❌ Item "${itemCode}" não encontrado.`;
  }

  // Se encontrou múltiplos, mostrar lista
  if (items.length > 1) {
    let response = `🔍 *${items.length} itens encontrados para "${itemCode}"*
━━━━━━━━━━━━━━━━━━`;

    items.forEach((item: any, idx: number) => {
      const order = item.orders;
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      response += `\n\n${idx + 1}. 📦 *${item.item_code}*
   Pedido: #${order?.order_number || 'N/A'}
   Cliente: ${order?.customer_name?.substring(0, 20) || 'N/A'}
   💰 R$ ${Number(itemValue).toLocaleString('pt-BR')}`;
    });

    response += `\n\n💡 _Use "item ${items[0].item_code}" para detalhes completos._`;
    return response;
  }

  // Item único - mostrar detalhes completos
  const item = items[0];
  const order = item.orders;
  const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
  
  // Calcular tempo na fase
  const phaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at);
  const daysInPhase = Math.ceil((today.getTime() - phaseStarted.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calcular SLA
  let slaStatus = '⚪ Não definido';
  let daysToSla = null;
  if (item.sla_deadline) {
    const slaDate = new Date(item.sla_deadline);
    daysToSla = Math.ceil((slaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToSla < 0) slaStatus = `🔴 Vencido há ${Math.abs(daysToSla)}d`;
    else if (daysToSla === 0) slaStatus = '🟡 Vence hoje';
    else if (daysToSla <= 2) slaStatus = `🟡 Vence em ${daysToSla}d`;
    else slaStatus = `🟢 OK (${daysToSla}d)`;
  }

  const sourceLabels: Record<string, string> = {
    'in_stock': '📦 Em Estoque',
    'production': '🔧 Produção',
    'out_of_stock': '🛒 Compra',
  };
  const sourceText = sourceLabels[item.item_source_type] || item.item_source_type || 'N/A';

  const statusLabels: Record<string, string> = {
    'pending': '⏳ Pendente',
    'in_progress': '🔧 Em Andamento',
    'completed': '✅ Concluído',
    'delivered': '✅ Entregue',
    'cancelled': '❌ Cancelado',
  };
  const statusText = statusLabels[item.item_status] || item.item_status || 'N/A';

  return `📦 *Item: ${item.item_code}*
━━━━━━━━━━━━━━━━━━
📝 ${item.item_description || 'Sem descrição'}

📋 *Pedido:* #${order?.order_number || 'N/A'}
👤 *Cliente:* ${order?.customer_name || 'N/A'}
📍 *Status Pedido:* ${order?.status || 'N/A'}

💰 *Financeiro:*
• Quantidade: ${item.requested_quantity} un
• Preço Unit: R$ ${Number(item.unit_price || 0).toLocaleString('pt-BR')}
• Valor Total: R$ ${Number(itemValue).toLocaleString('pt-BR')}

⏱️ *Tempos:*
• Origem: ${sourceText}
• Fase Atual: ${item.current_phase || 'N/A'}
• Tempo na Fase: ${daysInPhase} dias
• SLA: ${slaStatus}

📅 *Datas:*
• Entrega Item: ${item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('pt-BR') : 'N/A'}
• Entrega Pedido: ${order?.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'N/A'}`;
}

// Buscar itens com SLA vencido
async function getOverdueItems(supabase: any): Promise<string> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id, item_code, item_description, sla_deadline, current_phase, phase_started_at,
      unit_price, total_value, requested_quantity,
      orders(order_number, customer_name, status)
    `)
    .lt('sla_deadline', todayStr)
    .not('item_status', 'in', '("completed","delivered","cancelled")')
    .order('sla_deadline', { ascending: true })
    .limit(15);

  if (!items || items.length === 0) {
    return `✅ *Itens com SLA*
━━━━━━━━━━━━━━━━━━

🎉 Nenhum item com SLA vencido!
Todos os itens estão dentro do prazo.`;
  }

  let totalValue = 0;
  let response = `🔴 *${items.length} Itens com SLA Vencido*
━━━━━━━━━━━━━━━━━━`;

  items.slice(0, 10).forEach((item: any, idx: number) => {
    const order = item.orders;
    const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
    totalValue += Number(itemValue);
    
    const slaDate = new Date(item.sla_deadline);
    const daysOverdue = Math.ceil((today.getTime() - slaDate.getTime()) / (1000 * 60 * 60 * 24));
    
    response += `\n\n${idx + 1}. 📦 *${item.item_code}*
   Pedido: #${order?.order_number || 'N/A'}
   Fase: ${item.current_phase || 'N/A'}
   ⏱️ ${daysOverdue}d atrasado | 💰 R$ ${Number(itemValue).toLocaleString('pt-BR')}`;
  });

  if (items.length > 10) {
    response += `\n\n... e mais ${items.length - 10} itens`;
  }

  response += `\n\n━━━━━━━━━━━━━━━━━━
💰 *Valor em Risco:* R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

⚠️ _Ação imediata necessária!_`;

  return response;
}

// Buscar itens parados na mesma fase
async function getStuckItems(supabase: any, thresholdDays: number = 5): Promise<string> {
  const today = new Date();
  const thresholdDate = new Date(today.getTime() - thresholdDays * 24 * 60 * 60 * 1000);

  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id, item_code, item_description, current_phase, phase_started_at, created_at,
      unit_price, total_value, requested_quantity, item_status,
      orders(order_number, customer_name, status)
    `)
    .not('item_status', 'in', '("completed","delivered","cancelled")')
    .order('phase_started_at', { ascending: true })
    .limit(50);

  if (!items || items.length === 0) {
    return `✅ *Itens Parados*
━━━━━━━━━━━━━━━━━━

🎉 Nenhum item parado encontrado!`;
  }

  // Filtrar itens parados há mais de X dias
  const stuckItems = items.filter((item: any) => {
    const phaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at);
    return phaseStarted < thresholdDate;
  });

  if (stuckItems.length === 0) {
    return `✅ *Itens Parados (>${thresholdDays} dias)*
━━━━━━━━━━━━━━━━━━

🎉 Nenhum item parado há mais de ${thresholdDays} dias!`;
  }

  // Agrupar por fase
  const byPhase: Record<string, any[]> = {};
  stuckItems.forEach((item: any) => {
    const phase = item.current_phase || 'Indefinido';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(item);
  });

  let response = `⏰ *${stuckItems.length} Itens Parados (>${thresholdDays}d)*
━━━━━━━━━━━━━━━━━━`;

  Object.entries(byPhase)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([phase, phaseItems]) => {
      const emoji = phase.includes('Produção') ? '🔧' : 
                    phase.includes('Lab') ? '🔬' : 
                    phase.includes('Embalagem') ? '📦' : 
                    phase.includes('Faturamento') ? '💳' : '📋';
      
      response += `\n\n${emoji} *${phase}* (${phaseItems.length})`;
      
      phaseItems.slice(0, 3).forEach((item: any) => {
        const order = item.orders;
        const phaseStarted = item.phase_started_at ? new Date(item.phase_started_at) : new Date(item.created_at);
        const daysStuck = Math.ceil((today.getTime() - phaseStarted.getTime()) / (1000 * 60 * 60 * 24));
        
        response += `\n   • ${item.item_code} - #${order?.order_number || 'N/A'} (${daysStuck}d)`;
      });

      if (phaseItems.length > 3) {
        response += `\n   ... +${phaseItems.length - 3} itens`;
      }
    });

  response += `\n\n🔍 _Verificar gargalos operacionais!_`;

  return response;
}

// ==================== NOVAS FUNÇÕES DE ANÁLISE AVANÇADA ====================

// Análise de valor por fase
async function getValueByPhase(supabase: any): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const phaseMap: Record<string, string> = {
    'almox_ssm_pending': '📥 Almox SSM', 'almox_ssm_received': '📥 Almox SSM',
    'order_generation_pending': '📋 Gerar Ordem', 'order_in_creation': '📋 Gerar Ordem', 'order_generated': '📋 Gerar Ordem',
    'purchase_pending': '🛒 Compras', 'purchase_quoted': '🛒 Compras', 'purchase_ordered': '🛒 Compras',
    'almox_general_separating': '📦 Almox Geral', 'almox_general_ready': '📦 Almox Geral',
    'in_production': '🔧 Produção', 'separation_started': '🔧 Produção', 'awaiting_material': '🔧 Produção',
    'awaiting_lab': '🔬 Laboratório', 'in_lab_analysis': '🔬 Laboratório',
    'in_packaging': '📦 Embalagem', 'ready_for_shipping': '📦 Embalagem',
    'freight_quote_requested': '💰 Cotação', 'freight_quote_received': '💰 Cotação',
    'ready_to_invoice': '💳 À Faturar', 'pending_invoice_request': '💳 À Faturar',
    'invoice_requested': '🧾 Faturamento', 'awaiting_invoice': '🧾 Faturamento',
    'released_for_shipping': '📤 Expedição', 'in_expedition': '📤 Expedição',
    'in_transit': '🚚 Trânsito', 'collected': '🚚 Trânsito',
  };

  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  const phaseValues: Record<string, { count: number; value: number }> = {};
  let totalValue = 0;

  (orders || []).forEach((order: any) => {
    const phase = phaseMap[order.status] || '📋 Outros';
    const value = calcOrderValue(order);
    totalValue += value;
    
    if (!phaseValues[phase]) phaseValues[phase] = { count: 0, value: 0 };
    phaseValues[phase].count++;
    phaseValues[phase].value += value;
  });

  const sorted = Object.entries(phaseValues).sort((a, b) => b[1].value - a[1].value);

  let response = `💰 *Valor por Fase*
━━━━━━━━━━━━━━━━━━
💼 Total em Produção: *R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}*
📦 Pedidos Ativos: ${(orders || []).length}

*Distribuição:*`;

  sorted.forEach(([phase, data]) => {
    const percent = totalValue > 0 ? Math.round((data.value / totalValue) * 100) : 0;
    response += `\n${phase}: R$ ${data.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (${percent}%)
   └ ${data.count} pedidos`;
  });

  return response;
}

// Análise de lead time
async function getLeadTimeAnalysis(supabase: any): Promise<string> {
  const today = new Date();

  const { data: completedOrders } = await supabase
    .from('orders')
    .select('id, created_at, updated_at, order_type, status')
    .in('status', ['completed', 'delivered'])
    .gte('updated_at', new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (!completedOrders || completedOrders.length === 0) {
    return `⏱️ *Análise de Lead Time*
━━━━━━━━━━━━━━━━━━
_Sem pedidos concluídos nos últimos 30 dias para análise._`;
  }

  const leadTimes: number[] = [];
  const byType: Record<string, number[]> = {};

  completedOrders.forEach((order: any) => {
    const created = new Date(order.created_at);
    const completed = new Date(order.updated_at);
    const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    leadTimes.push(days);
    
    const type = order.order_type || 'standard';
    if (!byType[type]) byType[type] = [];
    byType[type].push(days);
  });

  const avgDays = Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length);
  const sortedLT = [...leadTimes].sort((a, b) => a - b);
  const medianDays = sortedLT[Math.floor(sortedLT.length / 2)];
  const minDays = Math.min(...leadTimes);
  const maxDays = Math.max(...leadTimes);

  let response = `⏱️ *Análise de Lead Time (30 dias)*
━━━━━━━━━━━━━━━━━━
📊 Amostra: ${completedOrders.length} pedidos concluídos

📈 *Estatísticas Gerais:*
• Média: *${avgDays} dias*
• Mediana: ${medianDays} dias
• Mínimo: ${minDays} dias
• Máximo: ${maxDays} dias

📦 *Por Tipo de Pedido:*`;

  Object.entries(byType).forEach(([type, times]) => {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    response += `\n• ${type}: ${avg} dias (${times.length} pedidos)`;
  });

  // Avaliar performance
  const targetDays = 10; // SLA target
  const onTarget = leadTimes.filter(d => d <= targetDays).length;
  const onTargetRate = Math.round((onTarget / leadTimes.length) * 100);

  response += `\n\n🎯 *Performance vs Meta (${targetDays}d):*
• Taxa de cumprimento: ${onTargetRate}%
• ${onTarget}/${leadTimes.length} pedidos no prazo`;

  return response;
}

// Top clientes por valor
async function getTopCustomers(supabase: any, limit: number = 10): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, status, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  const customerData: Record<string, { count: number; value: number; delayed: number }> = {};
  const today = new Date();

  (orders || []).forEach((order: any) => {
    const customer = order.customer_name || 'N/A';
    const value = calcOrderValue(order);
    
    if (!customerData[customer]) {
      customerData[customer] = { count: 0, value: 0, delayed: 0 };
    }
    customerData[customer].count++;
    customerData[customer].value += value;
  });

  const sorted = Object.entries(customerData)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, limit);

  const totalValue = sorted.reduce((sum, [, data]) => sum + data.value, 0);

  let response = `👥 *Top ${limit} Clientes (por Valor)*
━━━━━━━━━━━━━━━━━━
💰 Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  sorted.forEach(([customer, data], idx) => {
    const percent = totalValue > 0 ? Math.round((data.value / totalValue) * 100) : 0;
    response += `\n
${idx + 1}. *${customer.substring(0, 25)}*
   💰 R$ ${data.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (${percent}%)
   📦 ${data.count} pedidos ativos`;
  });

  return response;
}

// Previsão de risco para próxima semana
async function getRiskForecast(supabase: any): Promise<string> {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, updated_at, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .lte('delivery_date', nextWeek.toISOString().split('T')[0])
    .order('delivery_date', { ascending: true });

  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  // Fases iniciais/médias que indicam risco
  const riskyStatuses = [
    'almox_ssm_pending', 'almox_ssm_received', 'order_generation_pending', 'order_in_creation',
    'purchase_pending', 'purchase_quoted', 'in_production', 'awaiting_material'
  ];

  const atRisk: any[] = [];
  let totalRiskValue = 0;

  (orders || []).forEach((order: any) => {
    const deliveryDate = new Date(order.delivery_date);
    const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const updatedAt = new Date(order.updated_at);
    const daysInPhase = Math.ceil((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Critérios de risco:
    // 1. Prazo < 3 dias e status inicial
    // 2. Parado na fase > 3 dias com prazo < 5 dias
    // 3. Já atrasado
    
    const isRisky = 
      (daysUntil < 3 && riskyStatuses.includes(order.status)) ||
      (daysInPhase > 3 && daysUntil < 5) ||
      (daysUntil < 0);
    
    if (isRisky) {
      const value = calcOrderValue(order);
      totalRiskValue += value;
      atRisk.push({
        ...order,
        daysUntil,
        daysInPhase,
        value,
        riskLevel: daysUntil < 0 ? 'ATRASADO' : daysUntil < 2 ? 'CRÍTICO' : 'ALTO'
      });
    }
  });

  if (atRisk.length === 0) {
    return `🔮 *Previsão de Risco (7 dias)*
━━━━━━━━━━━━━━━━━━

✅ Nenhum pedido com risco elevado de atraso!
Todos os pedidos estão progredindo adequadamente.`;
  }

  atRisk.sort((a, b) => a.daysUntil - b.daysUntil);

  let response = `🔮 *Previsão de Risco (7 dias)*
━━━━━━━━━━━━━━━━━━
⚠️ *${atRisk.length} pedidos com risco de atraso*
💰 Valor em risco: R$ ${totalRiskValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}

*Pedidos críticos:*`;

  atRisk.slice(0, 8).forEach((order, idx) => {
    const icon = order.riskLevel === 'ATRASADO' ? '🔴' : order.riskLevel === 'CRÍTICO' ? '🟡' : '🟠';
    response += `\n
${idx + 1}. ${icon} *#${order.order_number}* [${order.riskLevel}]
   👤 ${order.customer_name.substring(0, 20)}
   📍 ${order.status} (${order.daysInPhase}d na fase)
   📅 ${order.daysUntil < 0 ? `${Math.abs(order.daysUntil)}d atrasado` : `Vence em ${order.daysUntil}d`}
   💰 R$ ${order.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
  });

  if (atRisk.length > 8) {
    response += `\n\n... e mais ${atRisk.length - 8} pedidos em risco`;
  }

  response += `\n\n⚡ _Ação preventiva recomendada!_`;

  return response;
}

// Análise de capacidade por fase
async function getCapacityAnalysis(supabase: any): Promise<string> {
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, updated_at')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const phaseMap: Record<string, string> = {
    'in_production': 'Produção', 'separation_started': 'Produção', 'awaiting_material': 'Produção',
    'awaiting_lab': 'Laboratório', 'in_lab_analysis': 'Laboratório',
    'in_packaging': 'Embalagem', 'ready_for_shipping': 'Embalagem',
    'invoice_requested': 'Faturamento', 'awaiting_invoice': 'Faturamento',
    'released_for_shipping': 'Expedição', 'in_expedition': 'Expedição',
  };

  // Capacidades históricas (baseado em dados típicos)
  const capacityLimits: Record<string, number> = {
    'Produção': 25,
    'Laboratório': 10,
    'Embalagem': 15,
    'Faturamento': 20,
    'Expedição': 15,
  };

  const phaseLoad: Record<string, { count: number; avgDays: number }> = {};

  (orders || []).forEach((order: any) => {
    const phase = phaseMap[order.status];
    if (!phase) return;
    
    const updatedAt = new Date(order.updated_at);
    const daysInPhase = Math.ceil((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (!phaseLoad[phase]) phaseLoad[phase] = { count: 0, avgDays: 0 };
    phaseLoad[phase].count++;
    phaseLoad[phase].avgDays += daysInPhase;
  });

  // Calcular médias
  Object.keys(phaseLoad).forEach(phase => {
    if (phaseLoad[phase].count > 0) {
      phaseLoad[phase].avgDays = Math.round(phaseLoad[phase].avgDays / phaseLoad[phase].count);
    }
  });

  let response = `📊 *Análise de Capacidade*
━━━━━━━━━━━━━━━━━━

*Carga Atual por Fase:*`;

  let hasOverload = false;

  Object.entries(capacityLimits).forEach(([phase, limit]) => {
    const load = phaseLoad[phase] || { count: 0, avgDays: 0 };
    const utilizationPercent = Math.round((load.count / limit) * 100);
    
    let icon = '🟢';
    let status = 'Normal';
    if (utilizationPercent > 100) {
      icon = '🔴';
      status = 'SOBRECARGA';
      hasOverload = true;
    } else if (utilizationPercent > 80) {
      icon = '🟡';
      status = 'Atenção';
    }

    response += `\n
${icon} *${phase}*
   📦 ${load.count}/${limit} (${utilizationPercent}%) - ${status}
   ⏱️ Tempo médio: ${load.avgDays}d`;
  });

  if (hasOverload) {
    response += `\n\n⚠️ _Fases com sobrecarga identificadas!_
_Considere realocar recursos ou priorizar._`;
  } else {
    response += `\n\n✅ _Todas as fases com capacidade adequada._`;
  }

  return response;
}

// Performance de transportadoras
async function getCarrierPerformanceAnalysis(supabase: any): Promise<string> {
  const { data: quotes } = await supabase
    .from('freight_quotes')
    .select(`
      id, status, created_at, carriers(name),
      freight_quote_responses(freight_value, delivery_time_days, is_selected)
    `)
    .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  const carrierStats: Record<string, {
    totalQuotes: number;
    responded: number;
    selected: number;
    avgValue: number;
    avgDays: number;
    totalValue: number;
  }> = {};

  (quotes || []).forEach((quote: any) => {
    const carrierName = quote.carriers?.name || 'Desconhecida';
    
    if (!carrierStats[carrierName]) {
      carrierStats[carrierName] = {
        totalQuotes: 0, responded: 0, selected: 0,
        avgValue: 0, avgDays: 0, totalValue: 0
      };
    }
    
    carrierStats[carrierName].totalQuotes++;
    
    const responses = quote.freight_quote_responses || [];
    if (responses.length > 0) {
      carrierStats[carrierName].responded++;
      
      responses.forEach((r: any) => {
        if (r.is_selected) {
          carrierStats[carrierName].selected++;
          carrierStats[carrierName].totalValue += Number(r.freight_value) || 0;
        }
      });
    }
  });

  // Calcular médias
  Object.keys(carrierStats).forEach(carrier => {
    const stats = carrierStats[carrier];
    if (stats.selected > 0) {
      stats.avgValue = stats.totalValue / stats.selected;
    }
  });

  const sorted = Object.entries(carrierStats)
    .filter(([, stats]) => stats.totalQuotes >= 3)
    .sort((a, b) => b[1].selected - a[1].selected)
    .slice(0, 10);

  if (sorted.length === 0) {
    return `🚛 *Performance de Transportadoras*
━━━━━━━━━━━━━━━━━━
_Dados insuficientes para análise (últimos 60 dias)._`;
  }

  let response = `🚛 *Performance de Transportadoras (60d)*
━━━━━━━━━━━━━━━━━━`;

  sorted.forEach(([carrier, stats], idx) => {
    const responseRate = stats.totalQuotes > 0 ? Math.round((stats.responded / stats.totalQuotes) * 100) : 0;
    const winRate = stats.responded > 0 ? Math.round((stats.selected / stats.responded) * 100) : 0;
    
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    
    response += `\n
${medal} *${carrier.substring(0, 20)}*
   📊 Cotações: ${stats.totalQuotes} | Taxa resposta: ${responseRate}%
   🏆 Selecionada: ${stats.selected}x (${winRate}% win rate)`;
    
    if (stats.avgValue > 0) {
      response += `\n   💰 Média: R$ ${stats.avgValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
    }
  });

  return response;
}

// Análise de custo de frete
async function getFreightCostAnalysis(supabase: any): Promise<string> {
  const { data: responses } = await supabase
    .from('freight_quote_responses')
    .select(`
      freight_value, delivery_time_days, is_selected, created_at,
      freight_quotes(orders(municipality, delivery_address))
    `)
    .eq('is_selected', true)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  if (!responses || responses.length === 0) {
    return `💰 *Análise de Custo de Frete*
━━━━━━━━━━━━━━━━━━
_Sem dados de frete aprovados nos últimos 90 dias._`;
  }

  const values: number[] = responses.map((r: any) => Number(r.freight_value) || 0).filter((v: number) => v > 0);
  const totalFreight = values.reduce((a: number, b: number) => a + b, 0);
  const avgFreight = Math.round(totalFreight / values.length);
  const sortedValues = [...values].sort((a, b) => a - b);
  const medianFreight = sortedValues[Math.floor(sortedValues.length / 2)];
  const minFreight = Math.min(...values);
  const maxFreight = Math.max(...values);

  // Por estado
  const byState: Record<string, { count: number; total: number }> = {};
  responses.forEach((r: any) => {
    const state = r.freight_quotes?.orders?.municipality || 'N/A';
    const value = Number(r.freight_value) || 0;
    
    if (!byState[state]) byState[state] = { count: 0, total: 0 };
    byState[state].count++;
    byState[state].total += value;
  });

  let response = `💰 *Análise de Custo de Frete (90d)*
━━━━━━━━━━━━━━━━━━
📊 Amostra: ${values.length} fretes aprovados
💵 Total gasto: R$ ${totalFreight.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}

📈 *Estatísticas:*
• Média: R$ ${avgFreight.toLocaleString('pt-BR')}
• Mediana: R$ ${medianFreight.toLocaleString('pt-BR')}
• Mínimo: R$ ${minFreight.toLocaleString('pt-BR')}
• Máximo: R$ ${maxFreight.toLocaleString('pt-BR')}

🗺️ *Por Estado (Top 5):*`;

  const sortedStates = Object.entries(byState)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  sortedStates.forEach(([state, data]) => {
    const avg = Math.round(data.total / data.count);
    response += `\n• ${state}: R$ ${avg.toLocaleString('pt-BR')} (${data.count} envios)`;
  });

  return response;
}

// Análise de destinos
async function getDestinationAnalysis(supabase: any): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, municipality, delivery_address, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  const byState: Record<string, { count: number; value: number }> = {};
  const byCity: Record<string, { count: number; value: number; state: string }> = {};

  (orders || []).forEach((order: any) => {
    const state = order.municipality || 'N/A';
    const city = order.delivery_address?.split(',')[0] || 'N/A';
    const value = calcOrderValue(order);

    if (!byState[state]) byState[state] = { count: 0, value: 0 };
    byState[state].count++;
    byState[state].value += value;

    const cityKey = `${city}/${state}`;
    if (!byCity[cityKey]) byCity[cityKey] = { count: 0, value: 0, state };
    byCity[cityKey].count++;
    byCity[cityKey].value += value;
  });

  const sortedStates = Object.entries(byState)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const sortedCities = Object.entries(byCity)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const totalOrders = (orders || []).length;
  const totalValue = Object.values(byState).reduce((sum, s) => sum + s.value, 0);

  let response = `🗺️ *Análise de Destinos*
━━━━━━━━━━━━━━━━━━
📦 Pedidos Ativos: ${totalOrders}
💰 Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}

📍 *Por Estado:*`;

  sortedStates.forEach(([state, data]) => {
    const percent = totalOrders > 0 ? Math.round((data.count / totalOrders) * 100) : 0;
    response += `\n• ${state}: ${data.count} (${percent}%) - R$ ${data.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
  });

  response += `\n\n🏙️ *Top Cidades:*`;
  sortedCities.forEach(([city, data]) => {
    response += `\n• ${city}: ${data.count} pedidos`;
  });

  return response;
}

// Itens críticos (importados, urgentes)
async function getCriticalItems(supabase: any): Promise<string> {
  const today = new Date();
  const threeDaysAhead = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id, item_code, item_description, item_source_type, sla_deadline, 
      is_imported, import_lead_time_days, current_phase, unit_price, total_value, requested_quantity,
      orders(order_number, customer_name)
    `)
    .or('is_imported.eq.true,item_source_type.eq.out_of_stock')
    .not('item_status', 'in', '("completed","delivered","cancelled")')
    .lte('sla_deadline', threeDaysAhead.toISOString().split('T')[0])
    .order('sla_deadline', { ascending: true })
    .limit(20);

  if (!items || items.length === 0) {
    return `🚨 *Itens Críticos*
━━━━━━━━━━━━━━━━━━

✅ Nenhum item importado/compra com SLA crítico!`;
  }

  let totalValue = 0;
  
  let response = `🚨 *Itens Críticos (Importados/Compra)*
━━━━━━━━━━━━━━━━━━
⚠️ ${items.length} itens com SLA ≤ 3 dias`;

  items.slice(0, 10).forEach((item: any, idx: number) => {
    const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
    totalValue += Number(itemValue);
    
    const slaDate = new Date(item.sla_deadline);
    const daysToSla = Math.ceil((slaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 1000));
    const icon = daysToSla < 0 ? '🔴' : daysToSla === 0 ? '🟡' : '🟠';
    const source = item.is_imported ? '🌍 Importado' : '🛒 Compra';
    
    response += `\n
${idx + 1}. ${icon} *${item.item_code}*
   ${source} | Pedido: #${item.orders?.order_number || 'N/A'}
   ⏱️ SLA: ${daysToSla < 0 ? `${Math.abs(daysToSla)}d vencido` : `${daysToSla}d`}
   💰 R$ ${Number(itemValue).toLocaleString('pt-BR')}`;
  });

  response += `\n\n💰 *Valor em risco:* R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  return response;
}

// Materiais pendentes
async function getPendingMaterials(supabase: any): Promise<string> {
  const today = new Date();

  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id, item_code, item_description, item_source_type, created_at, current_phase,
      unit_price, total_value, requested_quantity,
      orders(order_number, customer_name, delivery_date)
    `)
    .eq('item_source_type', 'out_of_stock')
    .not('item_status', 'in', '("completed","delivered","cancelled")')
    .order('created_at', { ascending: true })
    .limit(30);

  if (!items || items.length === 0) {
    return `📦 *Materiais Pendentes*
━━━━━━━━━━━━━━━━━━

✅ Nenhum item aguardando compra/material!`;
  }

  let totalValue = 0;

  let response = `📦 *Materiais Pendentes de Compra*
━━━━━━━━━━━━━━━━━━
⚠️ ${items.length} itens aguardando material`;

  items.slice(0, 10).forEach((item: any, idx: number) => {
    const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
    totalValue += Number(itemValue);
    
    const createdAt = new Date(item.created_at);
    const daysWaiting = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 1000));
    const deliveryDate = item.orders?.delivery_date ? new Date(item.orders.delivery_date).toLocaleDateString('pt-BR') : 'N/A';
    
    response += `\n
${idx + 1}. 📦 *${item.item_code}*
   Pedido: #${item.orders?.order_number || 'N/A'}
   ⏱️ Aguardando há ${daysWaiting}d | Entrega: ${deliveryDate}`;
  });

  response += `\n\n💰 *Valor pendente:* R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
📞 _Acionar fornecedores!_`;

  return response;
}

// Entregas de fim de semana
async function getWeekendDeliveries(supabase: any): Promise<string> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Dom, 6=Sáb
  
  // Calcular próximo fim de semana
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const saturday = new Date(today.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
  const sunday = new Date(saturday.getTime() + 24 * 60 * 60 * 1000);
  
  saturday.setHours(0, 0, 0, 0);
  sunday.setHours(23, 59, 59, 999);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, delivery_date, status, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .gte('delivery_date', saturday.toISOString().split('T')[0])
    .lte('delivery_date', sunday.toISOString().split('T')[0]);

  if (!orders || orders.length === 0) {
    return `📅 *Entregas de Fim de Semana*
━━━━━━━━━━━━━━━━━━
📆 ${saturday.toLocaleDateString('pt-BR')} - ${sunday.toLocaleDateString('pt-BR')}

✅ Nenhuma entrega programada para o fim de semana!`;
  }

  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  let totalValue = 0;

  let response = `📅 *Entregas de Fim de Semana*
━━━━━━━━━━━━━━━━━━
📆 ${saturday.toLocaleDateString('pt-BR')} - ${sunday.toLocaleDateString('pt-BR')}
⚠️ ${orders.length} pedidos programados`;

  orders.forEach((order: any, idx: number) => {
    const value = calcOrderValue(order);
    totalValue += value;
    const deliveryDate = new Date(order.delivery_date);
    const dayName = deliveryDate.getDay() === 6 ? 'Sábado' : 'Domingo';
    
    response += `\n
${idx + 1}. 📦 *#${order.order_number}*
   👤 ${order.customer_name.substring(0, 20)}
   📍 ${order.status} | ${dayName}
   💰 R$ ${value.toLocaleString('pt-BR')}`;
  });

  response += `\n\n💰 *Total:* R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
⚠️ _Verificar disponibilidade de entrega!_`;

  return response;
}

// Gerar resumo do dia
async function getDailySummary(supabase: any): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, created_at, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  
  // Função para calcular valor do pedido
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };
  
  const totalValue = activeOrders.reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);

  const phaseCount: Record<string, number> = {};
  const phaseMap: Record<string, string> = {
    // Almox SSM
    'almox_ssm_pending': 'Almox SSM',
    'almox_ssm_received': 'Almox SSM',
    // Gerar Ordem
    'order_generation_pending': 'Gerar Ordem',
    'order_in_creation': 'Gerar Ordem',
    'order_generated': 'Gerar Ordem',
    // Almox Geral
    'almox_general_separating': 'Almox Geral',
    'almox_general_ready': 'Almox Geral',
    'almox_general_received': 'Almox Geral',
    // Compras
    'purchase_pending': 'Compras',
    'purchase_quoted': 'Compras',
    'purchase_ordered': 'Compras',
    'purchase_received': 'Compras',
    // Produção
    'pending': 'Produção',
    'in_production': 'Produção',
    'separation_started': 'Produção',
    'awaiting_material': 'Produção',
    'separation_completed': 'Produção',
    'production_completed': 'Produção',
    // Gerar Saldo
    'balance_calculation': 'Gerar Saldo',
    'balance_review': 'Gerar Saldo',
    'balance_approved': 'Gerar Saldo',
    // Laboratório
    'awaiting_lab': 'Laboratório',
    'in_lab_analysis': 'Laboratório',
    'lab_completed': 'Laboratório',
    // Embalagem
    'in_quality_check': 'Embalagem',
    'in_packaging': 'Embalagem',
    'ready_for_shipping': 'Embalagem',
    // Cotação de Frete
    'freight_quote_requested': 'Cotação',
    'freight_quote_received': 'Cotação',
    'freight_approved': 'Cotação',
    // À Faturar
    'ready_to_invoice': 'À Faturar',
    'pending_invoice_request': 'À Faturar',
    // Faturamento
    'invoice_requested': 'Faturamento',
    'awaiting_invoice': 'Faturamento',
    'invoice_issued': 'Faturamento',
    'invoice_sent': 'Faturamento',
    // Expedição
    'released_for_shipping': 'Expedição',
    'in_expedition': 'Expedição',
    'pickup_scheduled': 'Expedição',
    'awaiting_pickup': 'Expedição',
    // Em Trânsito
    'in_transit': 'Transporte',
    'collected': 'Transporte',
  };

  activeOrders.forEach((order: any) => {
    const phase = phaseMap[order.status] || 'Outros';
    phaseCount[phase] = (phaseCount[phase] || 0) + 1;
  });

  const delayedCount = activeOrders.filter((o: any) => {
    if (!o.delivery_date) return false;
    return new Date(o.delivery_date) < new Date();
  }).length;

  const newToday = activeOrders.filter((o: any) => {
    const createdDate = new Date(o.created_at);
    return createdDate >= today;
  }).length;

  let response = `📊 *Resumo do Dia - ${today.toLocaleDateString('pt-BR')}*
━━━━━━━━━━━━━━━━━━
📦 Pedidos Ativos: ${activeOrders.length}
💰 Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
🆕 Novos Hoje: ${newToday}

*Por Fase:*`;

  const sortedPhases = Object.entries(phaseCount).sort((a, b) => b[1] - a[1]);
  sortedPhases.forEach(([phase, count]) => {
    const emoji = phase === 'Produção' ? '🔧' : 
                  phase === 'Embalagem' ? '📦' : 
                  phase === 'Transporte' ? '🚛' :
                  phase === 'Laboratório' ? '🔬' :
                  phase === 'Faturamento' ? '💳' :
                  phase === 'Cotação' ? '💰' :
                  phase === 'Expedição' ? '📤' : '📋';
    response += `\n${emoji} ${phase}: ${count}`;
  });

  response += `\n\n⚠️ *Alertas:*
• ${delayedCount} pedidos atrasados`;

  const todayDeliveries = activeOrders.filter((o: any) => {
    if (!o.delivery_date) return false;
    const deliveryDate = new Date(o.delivery_date);
    return deliveryDate.toDateString() === today.toDateString();
  }).length;

  if (todayDeliveries > 0) {
    response += `\n• ${todayDeliveries} entregas previstas para hoje`;
  }

  return response;
}

// Buscar pedidos atrasados
async function getDelayedOrders(supabase: any): Promise<string> {
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .lt('delivery_date', today.toISOString().split('T')[0])
    .order('delivery_date', { ascending: true })
    .limit(10);

  if (!orders || orders.length === 0) {
    return '✅ Nenhum pedido atrasado no momento!';
  }

  // Função para calcular valor do pedido
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  let response = `⚠️ *Pedidos Atrasados (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  let totalDelayed = 0;
  orders.forEach((order: any, index: number) => {
    const deliveryDate = new Date(order.delivery_date);
    const daysLate = Math.ceil((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    const value = calcOrderValue(order);
    totalDelayed += value;

    response += `

${index + 1}️⃣ *#${order.order_number}* - ${order.customer_name.substring(0, 25)}
   📍 ${order.status} | ⏱️ ${daysLate} dia${daysLate > 1 ? 's' : ''} atraso
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  response += `

💰 Total em atraso: R$ ${totalDelayed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Buscar pedidos por fase
async function getOrdersByPhase(supabase: any, phase: string): Promise<string> {
  const statusMap: Record<string, string[]> = {
    // Almox SSM
    'almox_ssm': ['almox_ssm_pending', 'almox_ssm_received'],
    // Gerar Ordem
    'order_generation': ['order_generation_pending', 'order_in_creation', 'order_generated'],
    // Almox Geral
    'almox_general': ['almox_general_separating', 'almox_general_ready', 'almox_general_received'],
    // Compras
    'purchases': ['purchase_pending', 'purchase_quoted', 'purchase_ordered', 'purchase_received'],
    // Produção
    'production_client': ['pending', 'in_production', 'separation_started', 'awaiting_material', 'separation_completed', 'production_completed'],
    // Gerar Saldo
    'balance': ['balance_calculation', 'balance_review', 'balance_approved'],
    // Laboratório
    'laboratory': ['awaiting_lab', 'in_lab_analysis', 'lab_completed'],
    // Embalagem
    'packaging': ['in_quality_check', 'in_packaging', 'ready_for_shipping'],
    // Cotação de Frete
    'freight_quote': ['freight_quote_requested', 'freight_quote_received', 'freight_approved'],
    // À Faturar
    'ready_to_invoice': ['ready_to_invoice', 'pending_invoice_request'],
    // Faturamento
    'invoicing': ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'],
    // Expedição
    'logistics': ['released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup'],
    // Em Trânsito
    'in_transit': ['in_transit', 'collected'],
  };

  const phaseLabels: Record<string, string> = {
    'almox_ssm': '📥 Almox SSM',
    'order_generation': '📝 Gerar Ordem',
    'almox_general': '📦 Almox Geral',
    'purchases': '🛒 Compras',
    'production_client': '🔧 Produção',
    'balance': '🧮 Gerar Saldo',
    'laboratory': '🔬 Laboratório',
    'packaging': '📦 Embalagem',
    'freight_quote': '💰 Cotação de Frete',
    'ready_to_invoice': '💳 À Faturar',
    'invoicing': '💳 Faturamento',
    'logistics': '📤 Expedição',
    'in_transit': '🚛 Em Trânsito',
  };

  const statuses = statusMap[phase] || [];
  if (statuses.length === 0) {
    return `❌ Fase "${phase}" não reconhecida.`;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, order_items(total_value, unit_price, requested_quantity)')
    .in('status', statuses)
    .order('delivery_date', { ascending: true })
    .limit(15);

  if (!orders || orders.length === 0) {
    return `✅ Nenhum pedido em ${phaseLabels[phase] || phase} no momento.`;
  }

  // Função para calcular valor do pedido
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  const phaseLabel = phaseLabels[phase] || phase;
  let response = `${phaseLabel} *Pedidos (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  orders.forEach((order: any, index: number) => {
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';
    const orderValue = calcOrderValue(order);
    const value = orderValue > 0 ? `R$ ${orderValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

    response += `
${index + 1}. *#${order.order_number}* - ${order.customer_name.substring(0, 20)}
   📅 ${deliveryDate} ${value ? `| ${value}` : ''}`;
  });

  return response;
}

// Buscar top pedidos por valor
async function getTopOrders(supabase: any, limit: number): Promise<string> {
  // Buscar pedidos ativos com seus itens para calcular valor
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .limit(100); // Buscar mais para depois ordenar por valor calculado

  if (!orders || orders.length === 0) {
    return '❌ Nenhum pedido ativo encontrado.';
  }

  // Função para calcular valor do pedido
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  // Calcular valores e ordenar
  const ordersWithValue = orders
    .map((order: any) => ({ ...order, calculatedValue: calcOrderValue(order) }))
    .filter((o: any) => o.calculatedValue > 0)
    .sort((a: any, b: any) => b.calculatedValue - a.calculatedValue)
    .slice(0, limit);

  if (ordersWithValue.length === 0) {
    return '❌ Nenhum pedido com valor informado.';
  }

  let response = `💰 *Top ${limit} Maiores Pedidos*
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  ordersWithValue.forEach((order: any, index: number) => {
    const value = order.calculatedValue;
    total += value;
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';

    response += `

${index + 1}️⃣ *#${order.order_number}*
   👤 ${order.customer_name.substring(0, 25)}
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   📅 ${deliveryDate}`;
  });

  response += `

━━━━━━━━━━━━━━━━━━
💰 Total Top ${limit}: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Buscar pedidos por cliente
async function searchByCustomer(supabase: any, customerName: string): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, order_items(total_value, unit_price, requested_quantity)')
    .ilike('customer_name', `%${customerName}%`)
    .not('status', 'in', '("completed","cancelled","delivered")')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return `❌ Nenhum pedido ativo encontrado para cliente "${customerName}".`;
  }

  // Função para calcular valor do pedido
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };

  let response = `👤 *Pedidos do Cliente "${customerName}"* (${orders.length})
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  orders.forEach((order: any, index: number) => {
    const value = calcOrderValue(order);
    total += value;
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';

    response += `

${index + 1}. *#${order.order_number}*
   📍 ${order.status} | 📅 ${deliveryDate}
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  response += `

💰 Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Mensagem de ajuda atualizada
function getHelpMessage(): string {
  return `📖 *Comandos Disponíveis*
━━━━━━━━━━━━━━━━━━

📦 *Status/Detalhes:*
• "status 12345" - Detalhes do pedido
• "volumes 12345" - Dimensões e pesos
• "cotações 12345" - Cotações de frete
• "histórico 12345" - Timeline de alterações
• "anexos 12345" - Arquivos do pedido

📊 *Métricas:*
• "métricas" ou "sla" - Dashboard completo
• "tendência" - Comparativo semanal
• "gargalos" - Identificar bottlenecks
• "alertas" - Ver alertas pendentes

📦 *Itens:*
• "item CODIGO" - Detalhes do item
• "itens atrasados" - SLA vencido
• "itens parados" - Travados >5 dias
• "itens críticos" - Importados/urgentes
• "materiais pendentes" - Aguardando compra

📈 *Análise Avançada:*
• "valor por fase" - Distribuição financeira
• "lead time" - Tempo médio de ciclo
• "top clientes" - Ranking por valor
• "risco semana" - Previsão de atrasos
• "capacidade" - Carga vs histórico

🚛 *Análise Logística:*
• "performance transportadora" - Ranking
• "custo frete" - Análise de custos
• "destinos" - Concentração geográfica
• "fim de semana" - Entregas no weekend

🔍 *Buscas:*
• "resumo" - Dashboard do dia
• "atrasados" - Lista de atrasos
• "cliente NOME" - Pedidos do cliente
• "rateio 4500" - Info do projeto
• "transportadora NOME" - Por carrier

🔧 *Por Fase:*
• "almox ssm" / "gerar ordem"
• "compras" / "almox geral"
• "produção" / "gerar saldo"
• "laboratório" / "embalagem"
• "cotação" / "à faturar"
• "faturamento" / "expedição"
• "trânsito"

💰 *Maiores Pedidos:*
• "top" ou "maiores"`;
}

// Processar consulta com IA para casos gerais
async function processWithAI(supabase: any, query: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return getHelpMessage() + '\n\n_Digite um comando acima ou faça uma pergunta específica._';
  }

  try {
    // Buscar métricas atuais para contexto
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('status, delivery_date, order_items(total_value, unit_price, requested_quantity)')
      .not('status', 'in', '("completed","cancelled","delivered")');

    const today = new Date();
    const phaseDistribution: Record<string, number> = {};
    let totalValue = 0;
    let delayedCount = 0;
    let criticalCount = 0;

    // Função para calcular valor do pedido
    const calcOrderValue = (order: any) => {
      return (order.order_items || []).reduce((sum: number, item: any) => {
        const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
        return sum + Number(itemValue);
      }, 0);
    };

    (activeOrders || []).forEach((o: any) => {
      const phase = getPhaseFromStatus(o.status);
      phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
      totalValue += calcOrderValue(o);
      
      if (o.delivery_date) {
        const deliveryDate = new Date(o.delivery_date);
        const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) delayedCount++;
        else if (daysUntil <= 2) criticalCount++;
      }
    });

    const metricsContext = `
MÉTRICAS ATUAIS (${today.toLocaleDateString('pt-BR')}):
- Pedidos ativos: ${(activeOrders || []).length}
- Valor total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
- Atrasados: ${delayedCount}
- Críticos (<3 dias): ${criticalCount}
- Distribuição: ${Object.entries(phaseDistribution).map(([p, c]) => `${p}: ${c}`).join(', ')}`;

    // Buscar conhecimento RAG para gestores
    const { data: ragItems } = await supabase
      .from('ai_knowledge_base')
      .select('title, content, category')
      .or('agent_type.eq.manager,agent_type.eq.general')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(5);

    const ragContext = ragItems?.map((r: any) => 
      `[${r.category}] ${r.title}: ${r.content.substring(0, 300)}`
    ).join('\n\n') || '';

    // Buscar regras e políticas ativas
    console.log('📋 Fetching AI rules and policies for manager...');
    const { data: aiRules } = await supabase
      .from('ai_rules')
      .select('policy, rule, rule_description, rule_risk, action')
      .eq('is_active', true)
      .limit(20);

    const rulesContext = (aiRules && aiRules.length > 0)
      ? aiRules.map((r: any) => `- [${r.policy}] ${r.rule_description} (Risco: ${r.rule_risk})`).join('\n')
      : '';
    
    console.log(`📋 Found ${aiRules?.length || 0} active rules for manager agent`);

    const systemPrompt = `Você é o *Assistente Gerencial IMPLY*, especializado em gestão de pedidos e operações logísticas.

## FASES DO KANBAN (ordem do fluxo):
1. 📥 *Almox SSM* - Recebimento inicial de materiais SSM
2. 📝 *Gerar Ordem* - Criação da ordem de produção
3. 🛒 *Compras* - Solicitação e recebimento de materiais
4. 📦 *Almox Geral* - Separação no almoxarifado geral
5. 🔧 *Produção* - Fabricação/montagem dos produtos
6. 🧮 *Gerar Saldo* - Cálculo de saldo para faturamento
7. 🔬 *Laboratório* - Testes e validações técnicas
8. 📦 *Embalagem* - Conferência e embalagem
9. 💰 *Cotação de Frete* - Solicitação de cotações às transportadoras
10. 💳 *À Faturar* - Aguardando solicitação de NF
11. 💳 *Faturamento* - Emissão de nota fiscal
12. 📤 *Expedição* - Liberação e coleta
13. 🚛 *Em Trânsito* - Em viagem até o cliente
14. ✅ *Conclusão* - Pedido entregue

## SLAs ESPERADOS POR FASE:
- Almox SSM/Geral: 2 dias
- Gerar Ordem: 2 dias
- Compras: 7 dias
- Produção: 7 dias
- Gerar Saldo: 1 dia
- Laboratório: 3 dias
- Embalagem: 2 dias
- Cotação Frete: 3 dias
- À Faturar: 1 dia
- Faturamento: 2 dias
- Expedição: 2 dias

${metricsContext}

## CONHECIMENTO DA BASE:
${ragContext || 'Nenhum conhecimento específico disponível.'}

## COMANDOS DISPONÍVEIS:
- "resumo" → Dashboard do dia
- "status NUMERO" → Detalhes do pedido
- "volumes NUMERO" → Dimensões e pesos
- "cotações NUMERO" → Cotações de frete
- "histórico NUMERO" → Timeline de alterações
- "métricas" → Dashboard de SLA
- "tendência" → Comparativo semanal
- "gargalos" → Identificar bottlenecks
- "atrasados" → Lista de atrasos
- "alertas" → Pendências urgentes
- "cliente NOME" → Pedidos do cliente
- "rateio CODIGO" → Info do projeto
- "transportadora NOME" → Por carrier
- FASE (ex: "produção", "compras", "à faturar") → Pedidos na fase

## REGRAS GERAIS:
1. Use formatação WhatsApp: *negrito*, _itálico_
2. Seja conciso e direto
3. Sugira comandos quando apropriado
4. Mencione SLAs quando houver atrasos
5. Destaque números importantes

${rulesContext ? `## 📋 POLÍTICAS E REGRAS ATIVAS:\n${rulesContext}` : ''}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return getHelpMessage();
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || getHelpMessage();
  } catch (error) {
    console.error('AI processing error:', error);
    return getHelpMessage();
  }
}

// ==================== HANDLER PRINCIPAL ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    if (!validateRequest(req)) {
      console.error('ai-agent-manager-query: Unauthorized request - invalid or missing credentials');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized - valid x-api-key header or internal source required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, senderPhone, carrierId } = await req.json();
    
    // Marcar tempo de início para calcular response time
    const startTime = Date.now();

    console.log('🔍 Manager query received:', { message, senderPhone });

    const intent = detectManagerIntent(message);
    console.log('📊 Detected intent:', intent);

    let responseMessage: string;

    switch (intent.type) {
      case 'order_status':
        responseMessage = await getOrderDetails(supabase, intent.params.orderNumber);
        break;
      case 'daily_summary':
        responseMessage = await getDailySummary(supabase);
        break;
      case 'delayed_orders':
        responseMessage = await getDelayedOrders(supabase);
        break;
      case 'orders_by_phase':
        responseMessage = await getOrdersByPhase(supabase, intent.params.phase);
        break;
      case 'top_orders':
        responseMessage = await getTopOrders(supabase, intent.params.limit || 5);
        break;
      case 'search_customer':
        responseMessage = await searchByCustomer(supabase, intent.params.customerName);
        break;
      case 'rateio':
        responseMessage = await getRateioProject(supabase, intent.params.projectCode);
        break;
      case 'volumes':
        responseMessage = await getOrderVolumes(supabase, intent.params.orderNumber);
        break;
      case 'cotacoes':
        responseMessage = await getFreightQuotes(supabase, intent.params.orderNumber);
        break;
      case 'historico':
        responseMessage = await getOrderHistory(supabase, intent.params.orderNumber);
        break;
      case 'anexos':
        responseMessage = await getOrderAttachments(supabase, intent.params.orderNumber);
        break;
      case 'metricas':
        responseMessage = await getSLAMetrics(supabase);
        break;
      case 'tendencia':
        responseMessage = await getWeeklyTrend(supabase);
        break;
      case 'gargalos':
        responseMessage = await getBottleneckAnalysis(supabase);
        break;
      case 'transportadora':
        responseMessage = await getCarrierOrders(supabase, intent.params.carrierName);
        break;
      case 'alertas':
        responseMessage = await getPendingAlerts(supabase);
        break;
      // ===================== NOVOS COMANDOS DE ITENS =====================
      case 'item_details':
        responseMessage = await getItemDetails(supabase, intent.params.itemCode);
        break;
      case 'overdue_items':
        responseMessage = await getOverdueItems(supabase);
        break;
      case 'stuck_items':
        responseMessage = await getStuckItems(supabase);
        break;
      // ===================== COMANDOS AVANÇADOS =====================
      case 'value_by_phase':
        responseMessage = await getValueByPhase(supabase);
        break;
      case 'lead_time':
        responseMessage = await getLeadTimeAnalysis(supabase);
        break;
      case 'top_customers':
        responseMessage = await getTopCustomers(supabase, intent.params.limit || 10);
        break;
      case 'risk_forecast':
        responseMessage = await getRiskForecast(supabase);
        break;
      case 'capacity_analysis':
        responseMessage = await getCapacityAnalysis(supabase);
        break;
      case 'carrier_performance':
        responseMessage = await getCarrierPerformanceAnalysis(supabase);
        break;
      case 'freight_cost':
        responseMessage = await getFreightCostAnalysis(supabase);
        break;
      case 'destination_analysis':
        responseMessage = await getDestinationAnalysis(supabase);
        break;
      case 'critical_items':
        responseMessage = await getCriticalItems(supabase);
        break;
      case 'pending_materials':
        responseMessage = await getPendingMaterials(supabase);
        break;
      case 'weekend_deliveries':
        responseMessage = await getWeekendDeliveries(supabase);
        break;
      // ===================== FIM COMANDOS =====================
      case 'help':
        responseMessage = getHelpMessage();
        break;
      default:
        responseMessage = await processWithAI(supabase, message);
    }

    // Enviar resposta via Mega API
    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';

    console.log('🔍 [DIAGNOSTIC] Checking WhatsApp instance connection...');
    console.log('🔍 [DIAGNOSTIC] MEGA_API_URL configured:', !!megaApiUrl);
    console.log('🔍 [DIAGNOSTIC] MEGA_API_TOKEN configured:', !!megaApiToken);

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_key, status, phone_number, connected_at')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Logging detalhado para diagnóstico
    if (instanceError) {
      console.error('❌ [DIAGNOSTIC] Error fetching instance:', instanceError);
    }
    
    console.log('📱 [DIAGNOSTIC] Instance query result:', {
      found: !!instance,
      instance_key: instance?.instance_key || 'NONE',
      status: instance?.status || 'NONE',
      phone: instance?.phone_number || 'NONE',
      connected_at: instance?.connected_at || 'NEVER',
    });

    // Se não encontrou instância conectada, buscar todas para diagnóstico
    if (!instance) {
      const { data: allInstances } = await supabase
        .from('whatsapp_instances')
        .select('instance_key, status, connected_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);
      
      console.log('⚠️ [DIAGNOSTIC] No connected instance! All instances:', allInstances?.map(i => ({
        key: i.instance_key,
        status: i.status,
        connected: i.connected_at,
        updated: i.updated_at
      })) || 'NONE');
    }

    if (!instance?.instance_key) {
      console.error('❌ [DIAGNOSTIC] CRITICAL: No connected WhatsApp instance found!');
      console.error('❌ [DIAGNOSTIC] Manager message will NOT be sent.');
      console.error('❌ [DIAGNOSTIC] Action required: Reconnect WhatsApp via QR Code scan');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          intent: intent.type,
          response: responseMessage,
          error: 'NO_WHATSAPP_INSTANCE',
          diagnostic: 'WhatsApp não está conectado. Escaneie o QR Code para reconectar.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!senderPhone) {
      console.error('❌ [DIAGNOSTIC] No sender phone provided');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'NO_SENDER_PHONE',
          intent: intent.type,
          response: responseMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prosseguir com envio
    console.log('✅ [DIAGNOSTIC] Instance connected, proceeding to send message');
    {
      let normalizedUrl = megaApiUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      normalizedUrl = normalizedUrl.replace(/\/+$/, '');

      let formattedPhone = senderPhone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      const sendUrl = `${normalizedUrl}/rest/sendMessage/${instance.instance_key}/text`;
      const body = {
        messageData: {
          to: formattedPhone,
          text: responseMessage,
          linkPreview: false,
        }
      };

      console.log('📤 Sending manager response to:', formattedPhone);

      // Multi-header fallback para compatibilidade com Mega API
      const authFormats: Record<string, string>[] = [
        { 'apikey': megaApiToken },
        { 'Authorization': `Bearer ${megaApiToken}` },
        { 'Apikey': megaApiToken },
      ];

      let messageSent = false;
      let lastError = '';

      for (const authHeader of authFormats) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...authHeader,
          };

          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          const responseText = await sendResponse.text();
          console.log(`📤 Response (${Object.keys(authHeader)[0]}): ${sendResponse.status} - ${responseText.substring(0, 200)}`);

          if (sendResponse.ok) {
            console.log('✅ Manager response sent successfully');
            messageSent = true;

            if (carrierId) {
              await supabase.from('carrier_conversations').insert({
                carrier_id: carrierId,
                conversation_type: 'general',
                message_direction: 'inbound',
                message_content: message,
                contact_type: 'manager',
                message_metadata: { intent: intent.type },
              });

              await supabase.from('carrier_conversations').insert({
                carrier_id: carrierId,
                conversation_type: 'general',
                message_direction: 'outbound',
                message_content: responseMessage,
                contact_type: 'manager',
                message_metadata: { sent_via: 'manager_query', intent: intent.type },
                sent_at: new Date().toISOString(),
              });
            }
            break; // Sucesso, sair do loop
          } else if (sendResponse.status === 401 || sendResponse.status === 403) {
            lastError = `${sendResponse.status}: ${responseText.substring(0, 200)}`;
            continue; // Tentar próximo header
          } else {
            lastError = `${sendResponse.status}: ${responseText.substring(0, 200)}`;
            break; // Outro erro, não tentar mais
          }
        } catch (fetchError) {
          lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
          console.error(`❌ Fetch error:`, lastError);
          continue;
        }
      }

      if (!messageSent) {
        console.error('❌ Failed to send manager response after trying all auth methods:', lastError);
      }
    }

    // 📊 Registrar feedback de aprendizado (fire and forget)
    const responseTimeMs = Date.now() - startTime;
    recordLearningFeedback(supabase, {
      message,
      response: responseMessage,
      intentType: intent.type,
      responseTimeMs,
      carrierId,
    }).catch(err => console.error('Learning feedback error:', err));

    return new Response(
      JSON.stringify({ 
        success: true, 
        intent: intent.type,
        response: responseMessage,
        responseTimeMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-agent-manager-query:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
