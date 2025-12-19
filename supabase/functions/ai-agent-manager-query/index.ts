import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryIntent {
  type: 'order_status' | 'daily_summary' | 'delayed_orders' | 'orders_by_phase' | 'top_orders' | 
        'search_customer' | 'help' | 'general' | 'rateio' | 'volumes' | 'cotacoes' | 
        'historico' | 'anexos' | 'metricas' | 'tendencia' | 'gargalos' | 'transportadora' | 'alertas';
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

// Detectar intenção da mensagem do gestor
function detectManagerIntent(message: string): QueryIntent {
  const correctedMessage = fuzzyMatch(message);
  const messageLower = correctedMessage.toLowerCase().trim();

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
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name')
    .ilike('order_number', `%${orderNumber}%`)
    .limit(1)
    .maybeSingle();

  if (!order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
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
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, destination_city, destination_state')
    .ilike('order_number', `%${orderNumber}%`)
    .limit(1)
    .maybeSingle();

  if (!order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
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
📍 Destino: ${order.destination_city || 'N/A'}/${order.destination_state || 'N/A'}
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
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, created_at')
    .ilike('order_number', `%${orderNumber}%`)
    .limit(1)
    .maybeSingle();

  if (!order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
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
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name')
    .ilike('order_number', `%${orderNumber}%`)
    .limit(1)
    .maybeSingle();

  if (!order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
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
  
  // Buscar pedidos ativos
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, delivery_date, total_value, created_at')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  const totalValue = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

  // Calcular métricas
  let onTime = 0;
  let late = 0;
  let critical = 0;
  let lateValue = 0;

  activeOrders.forEach((order: any) => {
    if (!order.delivery_date) return;
    const deliveryDate = new Date(order.delivery_date);
    const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      late++;
      lateValue += Number(order.total_value) || 0;
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

  // Pedidos criados esta semana
  const { data: thisWeekCreated } = await supabase
    .from('orders')
    .select('id, total_value')
    .gte('created_at', lastWeek.toISOString());

  // Pedidos criados semana passada
  const { data: lastWeekCreated } = await supabase
    .from('orders')
    .select('id, total_value')
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

  const thisWeekValue = (thisWeekCreated || []).reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);
  const lastWeekValue = (lastWeekCreated || []).reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

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
    .select('id, status, created_at, updated_at, total_value')
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
      b.orders.forEach(o => {
        const value = Number(o.total_value) || 0;
        response += `\n  - #${o.order_number || o.id.substring(0, 8)} (${o.daysInPhase}d)`;
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
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, status, delivery_date, 
      total_value, notes, created_at, freight_type, destination_city, destination_state,
      order_items(id, item_code, item_description, requested_quantity, delivered_quantity, item_status, delivery_date)
    `)
    .or(`order_number.ilike.%${orderNumber}%,order_number.eq.${orderNumber}`)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
  }

  const items = order.order_items || [];
  const itemsCount = items.length;
  const totalValue = order.total_value ? `R$ ${Number(order.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado';
  
  const deliveryDate = order.delivery_date ? new Date(order.delivery_date) : null;
  const today = new Date();
  const daysUntilDelivery = deliveryDate ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
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

  let response = `📦 *Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📍 Status: ${statusText}
📅 Previsão: ${deliveryDate ? deliveryDate.toLocaleDateString('pt-BR') : 'Não definida'}
💰 Valor: ${totalValue}
${slaStatus}

📋 *Itens (${itemsCount}):*`;

  items.slice(0, 5).forEach((item: any) => {
    response += `\n• ${item.requested_quantity}x ${item.item_code}`;
    if (item.item_description) {
      response += ` - ${item.item_description.substring(0, 30)}`;
    }
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

// Gerar resumo do dia
async function getDailySummary(supabase: any): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date, created_at')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  const totalValue = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

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
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .lt('delivery_date', today.toISOString().split('T')[0])
    .order('delivery_date', { ascending: true })
    .limit(10);

  if (!orders || orders.length === 0) {
    return '✅ Nenhum pedido atrasado no momento!';
  }

  let response = `⚠️ *Pedidos Atrasados (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  let totalDelayed = 0;
  orders.forEach((order: any, index: number) => {
    const deliveryDate = new Date(order.delivery_date);
    const daysLate = Math.ceil((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    const value = order.total_value ? Number(order.total_value) : 0;
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
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .in('status', statuses)
    .order('delivery_date', { ascending: true })
    .limit(15);

  if (!orders || orders.length === 0) {
    return `✅ Nenhum pedido em ${phaseLabels[phase] || phase} no momento.`;
  }

  const phaseLabel = phaseLabels[phase] || phase;
  let response = `${phaseLabel} *Pedidos (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  orders.forEach((order: any, index: number) => {
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';
    const value = order.total_value ? `R$ ${Number(order.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

    response += `
${index + 1}. *#${order.order_number}* - ${order.customer_name.substring(0, 20)}
   📅 ${deliveryDate} ${value ? `| ${value}` : ''}`;
  });

  return response;
}

// Buscar top pedidos por valor
async function getTopOrders(supabase: any, limit: number): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .not('total_value', 'is', null)
    .order('total_value', { ascending: false })
    .limit(limit);

  if (!orders || orders.length === 0) {
    return '❌ Nenhum pedido ativo encontrado.';
  }

  let response = `💰 *Top ${limit} Maiores Pedidos*
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  orders.forEach((order: any, index: number) => {
    const value = Number(order.total_value) || 0;
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
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .ilike('customer_name', `%${customerName}%`)
    .not('status', 'in', '("completed","cancelled","delivered")')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return `❌ Nenhum pedido ativo encontrado para cliente "${customerName}".`;
  }

  let response = `👤 *Pedidos do Cliente "${customerName}"* (${orders.length})
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  orders.forEach((order: any, index: number) => {
    const value = Number(order.total_value) || 0;
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
      .select('status, total_value, delivery_date')
      .not('status', 'in', '("completed","cancelled","delivered")');

    const today = new Date();
    const phaseDistribution: Record<string, number> = {};
    let totalValue = 0;
    let delayedCount = 0;
    let criticalCount = 0;

    (activeOrders || []).forEach((o: any) => {
      const phase = getPhaseFromStatus(o.status);
      phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
      totalValue += Number(o.total_value) || 0;
      
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

## REGRAS:
1. Use formatação WhatsApp: *negrito*, _itálico_
2. Seja conciso e direto
3. Sugira comandos quando apropriado
4. Mencione SLAs quando houver atrasos
5. Destaque números importantes`;

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, senderPhone, carrierId } = await req.json();

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
      case 'help':
        responseMessage = getHelpMessage();
        break;
      default:
        responseMessage = await processWithAI(supabase, message);
    }

    // Enviar resposta via Mega API
    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (instance?.instance_key && senderPhone) {
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        intent: intent.type,
        response: responseMessage,
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
