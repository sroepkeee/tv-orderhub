import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== INTERFACES ====================
interface OrderMetrics {
  // Resumo Executivo
  totalActive: number;
  totalValue: number;
  newToday: number;
  
  // SLA
  sla: {
    onTimeRate: number;
    onTimeCount: number;
    lateCount: number;
    criticalCount: number;
    lateValue: number;
  };
  
  // Tendências (vs semana anterior)
  trends: {
    newOrdersThisWeek: number;
    newOrdersLastWeek: number;
    newOrdersChange: number;
    deliveredThisWeek: number;
    deliveredLastWeek: number;
    deliveredChange: number;
    valueThisWeek: number;
    valueLastWeek: number;
    valueChange: number;
    dateChanges7d: number;
  };
  
  // Produção
  production: {
    avgDays: number;
    minDays: number;
    maxDays: number;
    medianDays: number;
    startedToday: number;
    endingToday: number;
  };
  
  // Distribuição por Fase (14 fases do Kanban)
  byPhase: {
    almoxSsm: number;
    gerarOrdem: number;
    compras: number;
    almoxGeral: number;
    producao: number;
    gerarSaldo: number;
    laboratorio: number;
    embalagem: number;
    cotacao: number;
    aFaturar: number;
    faturamento: number;
    expedicao: number;
    emTransito: number;
    conclusao: number;
  };
  
  // Gargalos identificados
  bottlenecks: Array<{
    phase: string;
    count: number;
    avgDays: number;
    threshold: number;
  }>;
  
  // Top 5 pedidos por valor
  topOrders: Array<{
    orderNumber: string;
    customer: string;
    totalValue: number;
    status: string;
    statusLabel: string;
    daysUntilDelivery: number;
  }>;
  
  // Alertas
  alerts: {
    delayed: number;
    critical: number;
    pendingLab: number;
    pendingPurchase: number;
  };
  
  // Detalhes por fase
  phaseDetails: Array<{
    phase: string;
    phaseKey: string;
    count: number;
    orders: Array<{
      orderNumber: string;
      customer: string;
      daysUntil: number;
    }>;
  }>;
}

// ==================== MAPEAMENTOS ====================
const statusToPhase: Record<string, string> = {
  // Almox SSM
  'almox_ssm_pending': 'almoxSsm',
  'almox_ssm_received': 'almoxSsm',
  'almox_ssm_in_review': 'almoxSsm',
  'almox_ssm_approved': 'almoxSsm',
  // Gerar Ordem
  'order_generation_pending': 'gerarOrdem',
  'order_in_creation': 'gerarOrdem',
  'order_generated': 'gerarOrdem',
  // Compras
  'purchase_pending': 'compras',
  'purchase_quoted': 'compras',
  'purchase_ordered': 'compras',
  'purchase_received': 'compras',
  // Almox Geral
  'almox_general_received': 'almoxGeral',
  'almox_general_separating': 'almoxGeral',
  'almox_general_ready': 'almoxGeral',
  // Produção
  'separation_started': 'producao',
  'in_production': 'producao',
  'awaiting_material': 'producao',
  'separation_completed': 'producao',
  'production_completed': 'producao',
  // Gerar Saldo
  'balance_calculation': 'gerarSaldo',
  'balance_review': 'gerarSaldo',
  'balance_approved': 'gerarSaldo',
  // Laboratório
  'awaiting_lab': 'laboratorio',
  'in_lab_analysis': 'laboratorio',
  'lab_completed': 'laboratorio',
  // Embalagem
  'in_quality_check': 'embalagem',
  'in_packaging': 'embalagem',
  'ready_for_shipping': 'embalagem',
  // Cotação de Frete
  'freight_quote_requested': 'cotacao',
  'freight_quote_received': 'cotacao',
  'freight_approved': 'cotacao',
  // À Faturar
  'ready_to_invoice': 'aFaturar',
  'pending_invoice_request': 'aFaturar',
  // Faturamento
  'invoice_requested': 'faturamento',
  'awaiting_invoice': 'faturamento',
  'invoice_issued': 'faturamento',
  'invoice_sent': 'faturamento',
  // Expedição
  'released_for_shipping': 'expedicao',
  'in_expedition': 'expedicao',
  'pickup_scheduled': 'expedicao',
  'awaiting_pickup': 'expedicao',
  // Em Trânsito
  'in_transit': 'emTransito',
  'collected': 'emTransito',
  // Conclusão
  'delivered': 'conclusao',
  'completed': 'conclusao',
  'cancelled': 'conclusao',
};

const phaseLabels: Record<string, string> = {
  'almoxSsm': '📥 Almox SSM',
  'gerarOrdem': '📋 Gerar Ordem',
  'compras': '🛒 Compras',
  'almoxGeral': '📦 Almox Geral',
  'producao': '🔧 Produção',
  'gerarSaldo': '📊 Gerar Saldo',
  'laboratorio': '🔬 Laboratório',
  'embalagem': '📦 Embalagem',
  'cotacao': '💰 Cotação Frete',
  'aFaturar': '💳 À Faturar',
  'faturamento': '🧾 Faturamento',
  'expedicao': '🚛 Expedição',
  'emTransito': '🚚 Em Trânsito',
  'conclusao': '✅ Conclusão',
};

const statusLabels: Record<string, string> = {
  'almox_ssm_pending': '📥 Almox SSM - Pendente',
  'almox_ssm_received': '📥 Almox SSM - Recebido',
  'order_generation_pending': '📋 Gerar Ordem - Pendente',
  'order_in_creation': '📋 Ordem em Criação',
  'order_generated': '📋 Ordem Gerada',
  'purchase_pending': '🛒 Compra Pendente',
  'purchase_quoted': '🛒 Compra Cotada',
  'purchase_ordered': '🛒 Compra Realizada',
  'almox_general_received': '📦 Almox Geral - Recebido',
  'almox_general_separating': '📦 Almox Geral - Separando',
  'almox_general_ready': '📦 Almox Geral - Pronto',
  'separation_started': '🔧 Separação Iniciada',
  'in_production': '🔧 Em Produção',
  'awaiting_material': '🔧 Aguardando Material',
  'separation_completed': '🔧 Separação Completa',
  'production_completed': '🔧 Produção Completa',
  'awaiting_lab': '🔬 Aguardando Lab',
  'in_lab_analysis': '🔬 Em Análise Lab',
  'lab_completed': '🔬 Lab Completo',
  'in_quality_check': '📦 Qualidade',
  'in_packaging': '📦 Em Embalagem',
  'ready_for_shipping': '📦 Pronto p/ Envio',
  'freight_quote_requested': '💰 Cotação Solicitada',
  'freight_quote_received': '💰 Cotação Recebida',
  'freight_approved': '💰 Frete Aprovado',
  'ready_to_invoice': '💳 Pronto p/ Faturar',
  'pending_invoice_request': '💳 Aguardando Solicitação',
  'invoice_requested': '🧾 NF Solicitada',
  'awaiting_invoice': '🧾 Aguardando NF',
  'invoice_issued': '🧾 NF Emitida',
  'invoice_sent': '🧾 NF Enviada',
  'released_for_shipping': '🚛 Liberado p/ Envio',
  'in_expedition': '🚛 Em Expedição',
  'pickup_scheduled': '🚛 Coleta Agendada',
  'awaiting_pickup': '🚛 Aguardando Coleta',
  'in_transit': '🚚 Em Trânsito',
  'collected': '🚚 Coletado',
  'delivered': '✅ Entregue',
  'completed': '✅ Concluído',
};

const phaseThresholds: Record<string, number> = {
  'almoxSsm': 2,
  'gerarOrdem': 2,
  'compras': 10,
  'almoxGeral': 2,
  'producao': 7,
  'gerarSaldo': 1,
  'laboratorio': 3,
  'embalagem': 2,
  'cotacao': 3,
  'aFaturar': 1,
  'faturamento': 2,
  'expedicao': 2,
  'emTransito': 5,
};

// ==================== CÁLCULOS ====================
async function calculateMetrics(supabase: any): Promise<OrderMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Buscar pedidos ativos COM order_items para calcular valor
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, status, 
      delivery_date, created_at, updated_at,
      order_items(id, item_code, item_status, unit_price, requested_quantity, total_value)
    `)
    .not('status', 'in', '("completed","cancelled","delivered")');

  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError);
  }

  const activeOrders = orders || [];
  console.log(`📦 Found ${activeOrders.length} active orders`);

  // Inicializar contadores por fase
  const byPhase = {
    almoxSsm: 0, gerarOrdem: 0, compras: 0, almoxGeral: 0,
    producao: 0, gerarSaldo: 0, laboratorio: 0, embalagem: 0,
    cotacao: 0, aFaturar: 0, faturamento: 0, expedicao: 0,
    emTransito: 0, conclusao: 0,
  };

  const phaseOrders: Record<string, any[]> = {};
  const phaseDays: Record<string, number[]> = {};
  
  let totalValue = 0;
  let newToday = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let criticalCount = 0;
  let lateValue = 0;
  let pendingLab = 0;
  let pendingPurchase = 0;
  const productionDays: number[] = [];
  let startedToday = 0;
  let endingToday = 0;

  activeOrders.forEach((order: any) => {
    const status = order.status || 'unknown';
    const phaseKey = statusToPhase[status] || 'conclusao';
    
    // Contar por fase
    if (phaseKey in byPhase) {
      (byPhase as any)[phaseKey]++;
    }
    
    // Agrupar pedidos por fase
    if (!phaseOrders[phaseKey]) phaseOrders[phaseKey] = [];
    if (!phaseDays[phaseKey]) phaseDays[phaseKey] = [];
    
    // Calcular dias na fase
    const updatedAt = new Date(order.updated_at || order.created_at);
    const daysInPhase = Math.ceil((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    phaseDays[phaseKey].push(daysInPhase);

    // Calcular dias até entrega
    let daysUntilDelivery = 999;
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    phaseOrders[phaseKey].push({
      orderNumber: order.order_number,
      customer: order.customer_name,
      daysUntil: daysUntilDelivery,
    });

    // Calcular valor somando dos itens
    const orderValue = (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
    totalValue += orderValue;
    
    // Guardar valor calculado no objeto order para uso posterior
    (order as any).calculated_value = orderValue;

    // Verificar se é novo hoje
    const createdAt = new Date(order.created_at);
    createdAt.setHours(0, 0, 0, 0);
    if (createdAt.getTime() === today.getTime()) {
      newToday++;
      startedToday++;
    }

    // Verificar prazo de entrega
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      
      if (deliveryDate.getTime() === today.getTime()) {
        endingToday++;
      }
      
      if (deliveryDate < today) {
        lateCount++;
        lateValue += orderValue;
      } else if (daysUntilDelivery <= 2) {
        criticalCount++;
      } else {
        onTimeCount++;
      }
    }

    // Verificar alertas específicos
    if (status === 'awaiting_lab' || status === 'in_lab_analysis') {
      pendingLab++;
    }
    if (status.startsWith('purchase_') || status === 'awaiting_material') {
      pendingPurchase++;
    }

    // Calcular tempo de produção
    if (phaseKey === 'producao') {
      productionDays.push(daysInPhase);
    }
  });

  // Calcular SLA rate
  const onTimeRate = activeOrders.length > 0 
    ? Math.round((onTimeCount / activeOrders.length) * 100) 
    : 100;

  // Calcular estatísticas de produção
  const production = {
    avgDays: productionDays.length > 0 ? Math.round(productionDays.reduce((a, b) => a + b, 0) / productionDays.length) : 0,
    minDays: productionDays.length > 0 ? Math.min(...productionDays) : 0,
    maxDays: productionDays.length > 0 ? Math.max(...productionDays) : 0,
    medianDays: productionDays.length > 0 ? productionDays.sort((a, b) => a - b)[Math.floor(productionDays.length / 2)] : 0,
    startedToday,
    endingToday,
  };

  // Identificar gargalos
  const bottlenecks: OrderMetrics['bottlenecks'] = [];
  for (const [phaseKey, days] of Object.entries(phaseDays)) {
    if (days.length === 0) continue;
    const avgDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
    const threshold = phaseThresholds[phaseKey] || 5;
    
    if (avgDays > threshold) {
      bottlenecks.push({
        phase: phaseLabels[phaseKey] || phaseKey,
        count: days.length,
        avgDays,
        threshold,
      });
    }
  }
  bottlenecks.sort((a, b) => b.avgDays - a.avgDays);

  // ==================== TENDÊNCIAS SEMANAIS ====================
  const { data: thisWeekCreated } = await supabase
    .from('orders')
    .select('id, order_items(total_value, unit_price, requested_quantity)')
    .gte('created_at', lastWeek.toISOString());

  const { data: lastWeekCreated } = await supabase
    .from('orders')
    .select('id, order_items(total_value, unit_price, requested_quantity)')
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', lastWeek.toISOString());

  const { data: thisWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .in('status', ['delivered', 'completed'])
    .gte('updated_at', lastWeek.toISOString());

  const { data: lastWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .in('status', ['delivered', 'completed'])
    .gte('updated_at', twoWeeksAgo.toISOString())
    .lt('updated_at', lastWeek.toISOString());

  // Contar mudanças de data nos últimos 7 dias
  const { count: dateChanges } = await supabase
    .from('delivery_date_changes')
    .select('id', { count: 'exact', head: true })
    .gte('changed_at', lastWeek.toISOString());

  const newThisWeek = thisWeekCreated?.length || 0;
  const newLastWeek = lastWeekCreated?.length || 0;
  const deliveredThisWeek = thisWeekDelivered?.length || 0;
  const deliveredLastWeek = lastWeekDelivered?.length || 0;
  
  // Calcular valor somando order_items
  const calcOrderValue = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
  };
  
  const valueThisWeek = (thisWeekCreated || []).reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);
  const valueLastWeek = (lastWeekCreated || []).reduce((sum: number, o: any) => sum + calcOrderValue(o), 0);

  const trends = {
    newOrdersThisWeek: newThisWeek,
    newOrdersLastWeek: newLastWeek,
    newOrdersChange: newLastWeek > 0 ? Math.round(((newThisWeek - newLastWeek) / newLastWeek) * 100) : 0,
    deliveredThisWeek,
    deliveredLastWeek,
    deliveredChange: deliveredLastWeek > 0 ? Math.round(((deliveredThisWeek - deliveredLastWeek) / deliveredLastWeek) * 100) : 0,
    valueThisWeek,
    valueLastWeek,
    valueChange: valueLastWeek > 0 ? Math.round(((valueThisWeek - valueLastWeek) / valueLastWeek) * 100) : 0,
    dateChanges7d: dateChanges || 0,
  };

  // ==================== TOP PEDIDOS ====================
  const topOrders = activeOrders
    .filter((o: any) => (o as any).calculated_value > 0)
    .sort((a: any, b: any) => ((b as any).calculated_value || 0) - ((a as any).calculated_value || 0))
    .slice(0, 5)
    .map((o: any) => {
      const deliveryDate = o.delivery_date ? new Date(o.delivery_date) : null;
      const daysUntil = deliveryDate 
        ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        orderNumber: o.order_number,
        customer: o.customer_name,
        totalValue: (o as any).calculated_value || 0,
        status: o.status,
        statusLabel: statusLabels[o.status] || o.status,
        daysUntilDelivery: daysUntil,
      };
    });

  // ==================== DETALHES POR FASE ====================
  const phaseDetails = Object.entries(byPhase)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([phaseKey, count]) => ({
      phase: phaseLabels[phaseKey] || phaseKey,
      phaseKey,
      count,
      orders: (phaseOrders[phaseKey] || []).slice(0, 3),
    }));

  return {
    totalActive: activeOrders.length,
    totalValue,
    newToday,
    sla: { onTimeRate, onTimeCount, lateCount, criticalCount, lateValue },
    trends,
    production,
    byPhase,
    bottlenecks,
    topOrders,
    alerts: { delayed: lateCount, critical: criticalCount, pendingLab, pendingPurchase },
    phaseDetails,
  };
}

// ==================== FORMATAÇÃO ====================
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getTrendIcon(change: number): string {
  if (change > 0) return '📈';
  if (change < 0) return '📉';
  return '➡️';
}

function getTrendArrow(change: number): string {
  if (change > 0) return `+${change}% ↑`;
  if (change < 0) return `${change}% ↓`;
  return '0%';
}

function formatReportMessage(metrics: OrderMetrics, date: Date): string {
  const dateStr = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let message = `📊 *RELATÓRIO GERENCIAL DIÁRIO*\n`;
  message += `📅 ${dateStr}\n\n`;

  // ========== RESUMO EXECUTIVO ==========
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📈 *RESUMO EXECUTIVO*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `• Pedidos Ativos: *${metrics.totalActive}*\n`;
  message += `• Valor em Produção: *${formatCurrency(metrics.totalValue)}*\n`;
  message += `• Taxa de Cumprimento: *${metrics.sla.onTimeRate}%* ${metrics.sla.onTimeRate >= 85 ? '✅' : metrics.sla.onTimeRate >= 70 ? '⚠️' : '🔴'}\n`;
  message += `• Novos Hoje: *${metrics.newToday}*\n\n`;

  // ========== ALERTAS CRÍTICOS ==========
  if (metrics.alerts.delayed > 0 || metrics.alerts.critical > 0 || metrics.alerts.pendingPurchase > 0) {
    message += `🚨 *ALERTAS CRÍTICOS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (metrics.alerts.delayed > 0) {
      message += `⚠️ *${metrics.alerts.delayed}* pedidos ATRASADOS (${formatCurrency(metrics.sla.lateValue)})\n`;
    }
    if (metrics.alerts.critical > 0) {
      message += `🔴 *${metrics.alerts.critical}* pedidos críticos (< 48h)\n`;
    }
    if (metrics.alerts.pendingLab > 0) {
      message += `🔬 *${metrics.alerts.pendingLab}* aguardando Laboratório\n`;
    }
    if (metrics.alerts.pendingPurchase > 0) {
      message += `🛒 *${metrics.alerts.pendingPurchase}* aguardando Compras\n`;
    }
    message += `\n`;
  }

  // ========== TENDÊNCIAS ==========
  message += `📊 *TENDÊNCIAS (vs semana anterior)*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `• Novos: ${metrics.trends.newOrdersThisWeek} (${getTrendArrow(metrics.trends.newOrdersChange)})\n`;
  message += `• Entregues: ${metrics.trends.deliveredThisWeek} (${getTrendArrow(metrics.trends.deliveredChange)})\n`;
  message += `• Valor: ${formatCurrency(metrics.trends.valueThisWeek)} (${getTrendArrow(metrics.trends.valueChange)})\n`;
  if (metrics.trends.dateChanges7d > 0) {
    message += `• Mudanças de prazo: ${metrics.trends.dateChanges7d}\n`;
  }
  message += `\n`;

  // ========== DISTRIBUIÇÃO POR FASE ==========
  message += `📦 *DISTRIBUIÇÃO POR FASE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  metrics.phaseDetails.slice(0, 10).forEach(phase => {
    message += `• ${phase.phase}: *${phase.count}*\n`;
  });
  message += `\n`;

  // ========== GARGALOS ==========
  if (metrics.bottlenecks.length > 0) {
    message += `🎯 *GARGALOS IDENTIFICADOS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.bottlenecks.slice(0, 3).forEach(b => {
      message += `⚠️ ${b.phase}: ${b.avgDays} dias (limite: ${b.threshold})\n`;
    });
    message += `\n`;
  }

  // ========== TOP 5 PEDIDOS ==========
  if (metrics.topOrders.length > 0) {
    message += `💰 *TOP 5 PEDIDOS (MAIOR VALOR)*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.topOrders.forEach((order, idx) => {
      const daysIcon = order.daysUntilDelivery < 0 ? '⚠️' : order.daysUntilDelivery <= 2 ? '🔴' : '🕐';
      const daysText = order.daysUntilDelivery < 0 
        ? `${Math.abs(order.daysUntilDelivery)}d atrasado`
        : order.daysUntilDelivery === 0 
          ? 'Hoje'
          : `${order.daysUntilDelivery}d`;
      
      message += `${idx + 1}. *${order.orderNumber}* - ${order.customer}\n`;
      message += `   ${formatCurrency(order.totalValue)} | ${order.statusLabel} | ${daysIcon} ${daysText}\n\n`;
    });
  }

  // ========== ESTATÍSTICAS DE PRODUÇÃO ==========
  if (metrics.production.avgDays > 0) {
    message += `🔧 *TEMPO EM PRODUÇÃO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `• Média: ${metrics.production.avgDays} dias\n`;
    message += `• Mín/Máx: ${metrics.production.minDays}/${metrics.production.maxDays} dias\n`;
    if (metrics.production.endingToday > 0) {
      message += `• Vencem hoje: ${metrics.production.endingToday}\n`;
    }
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🤖 _Relatório gerado às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_\n`;
  message += `_Sistema de Gestão Imply_`;

  return message;
}

// ==================== GERAÇÃO DE GRÁFICOS ====================
async function generateDistributionChart(metrics: OrderMetrics): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not configured, skipping chart generation');
      return null;
    }

    const phaseData = metrics.phaseDetails
      .slice(0, 8)
      .map(p => `${p.phase.replace(/[📥📋🛒📦🔧📊🔬💰💳🧾🚛🚚✅]/g, '').trim()}: ${p.count}`)
      .join(', ');
    
    const date = new Date().toLocaleDateString('pt-BR');

    const prompt = `Create a professional pie chart with the following data for a business report:
${phaseData}

Requirements:
- Modern, clean corporate style with dark theme
- Use vibrant colors: #3B82F6 (blue), #10B981 (green), #F59E0B (orange), #8B5CF6 (purple), #EC4899 (pink), #06B6D4 (cyan)
- Title: "Distribuição de Pedidos por Fase"
- Subtitle: "${date}"
- Show percentages on each slice (white text)
- Add a legend on the right side
- Dark gray background (#1F2937)
- High resolution, suitable for WhatsApp
- Dimensions: 800x600 pixels
- Professional business dashboard style`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      console.error('Distribution chart generation failed:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      return base64Data;
    }

    return null;
  } catch (error) {
    console.error('Error generating distribution chart:', error);
    return null;
  }
}

async function generateTrendChart(metrics: OrderMetrics): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return null;

    const prompt = `Create a professional grouped bar chart comparing weekly metrics:

Data:
- This Week New Orders: ${metrics.trends.newOrdersThisWeek}
- Last Week New Orders: ${metrics.trends.newOrdersLastWeek}
- This Week Delivered: ${metrics.trends.deliveredThisWeek}
- Last Week Delivered: ${metrics.trends.deliveredLastWeek}

Requirements:
- Modern corporate style with dark theme
- Two groups: "Novos" and "Entregues"
- Each group has 2 bars: "Esta Semana" (blue #3B82F6) and "Semana Anterior" (gray #6B7280)
- Title: "Tendência Semanal"
- Show values on top of each bar
- Dark gray background (#1F2937)
- White/light text
- Dimensions: 800x400 pixels
- Clean, minimal design`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      return imageUrl.split(',')[1];
    }

    return null;
  } catch (error) {
    console.error('Error generating trend chart:', error);
    return null;
  }
}

async function generateSLAGauge(metrics: OrderMetrics): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return null;

    const rate = metrics.sla.onTimeRate;
    const color = rate >= 85 ? '#10B981' : rate >= 70 ? '#F59E0B' : '#EF4444';
    const colorName = rate >= 85 ? 'green' : rate >= 70 ? 'yellow/orange' : 'red';

    const prompt = `Create a professional gauge/speedometer chart showing SLA compliance:

Value: ${rate}%

Requirements:
- Semi-circular gauge (180 degrees)
- Scale from 0 to 100%
- Current value: ${rate}% shown prominently in the center
- Needle pointing to ${rate}%
- Color zones: 0-70% red, 70-85% yellow, 85-100% green
- Current zone highlighted in ${colorName}
- Title: "Taxa de Cumprimento SLA"
- Dark gray background (#1F2937)
- White text
- Dimensions: 600x400 pixels
- Modern dashboard style`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      return imageUrl.split(',')[1];
    }

    return null;
  } catch (error) {
    console.error('Error generating SLA gauge:', error);
    return null;
  }
}

// ==================== WHATSAPP (ENVIO DIRETO VIA MEGA API) ====================
async function sendWhatsAppMessage(supabaseClient: any, phone: string, message: string): Promise<boolean> {
  try {
    // Buscar instância conectada do banco
    const { data: activeInstance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .maybeSingle();

    if (instanceError || !activeInstance) {
      console.error('❌ No connected WhatsApp instance found');
      return false;
    }

    // Formatar número
    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }

    // Configurar Mega API
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';

    console.log(`📤 Sending WhatsApp to ${phoneNumber} via instance ${activeInstance.instance_key}`);

    // Enviar diretamente via Mega API
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/text`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    const body = {
      messageData: {
        to: phoneNumber,
        text: message,
        linkPreview: false,
      }
    };

    // Tentar diferentes formatos de autenticação
    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    for (const authHeader of authFormats) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        console.log('✅ WhatsApp message sent to:', phoneNumber);
        return true;
      }

      if (response.status !== 401 && response.status !== 403) {
        const errorText = await response.text();
        console.error(`❌ Mega API error: ${response.status} - ${errorText}`);
        return false;
      }
    }

    console.error('❌ All auth methods failed for WhatsApp send');
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return false;
  }
}

async function sendWhatsAppImage(supabaseClient: any, phone: string, base64Data: string, caption: string): Promise<boolean> {
  try {
    // Buscar instância conectada
    const { data: activeInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .maybeSingle();

    if (!activeInstance) {
      console.error('❌ No connected WhatsApp instance for image send');
      return false;
    }

    // Formatar número
    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }

    // Configurar Mega API
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';

    // Endpoint para mídia
    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/image`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    const body = {
      messageData: {
        to: phoneNumber,
        image: `data:image/png;base64,${base64Data}`,
        caption: caption,
      }
    };

    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
    ];

    for (const authHeader of authFormats) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        console.log('✅ WhatsApp image sent to:', phoneNumber);
        return true;
      }

      if (response.status !== 401 && response.status !== 403) {
        const errorText = await response.text();
        console.error(`❌ Mega API image error: ${response.status} - ${errorText}`);
        return false;
      }
    }

    console.error('❌ All auth methods failed for image send');
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp image:', error);
    return false;
  }
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting enhanced daily management report...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let includeChart = true;
    let includeAllCharts = false;
    let testMode = false;
    let testPhone = null;

    try {
      const body = await req.json();
      includeChart = body.includeChart !== false;
      includeAllCharts = body.includeAllCharts === true;
      testMode = body.testMode === true;
      testPhone = body.testPhone;
    } catch {
      // No body provided
    }

    // ========== BUSCAR DESTINATÁRIOS ==========
    let recipients: any[] = [];
    
    if (testMode && testPhone) {
      recipients = [{ whatsapp: testPhone, id: null, full_name: 'Teste' }];
      console.log('🧪 Test mode - sending to:', testPhone);
    } else {
      // Buscar da tabela management_report_recipients (com fallback para admins)
      const { data: recipientsData, error: recipientsError } = await supabaseClient
        .from('management_report_recipients')
        .select('id, whatsapp, user_id, profiles:user_id(full_name)')
        .eq('is_active', true)
        .contains('report_types', ['daily']);

      if (!recipientsError && recipientsData && recipientsData.length > 0) {
        recipients = recipientsData.map((r: any) => ({
          id: r.id,
          whatsapp: r.whatsapp,
          full_name: r.profiles?.full_name || 'Gestor',
        }));
      } else {
        // Fallback: buscar admins com whatsapp
        const { data: admins } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          const adminIds = admins.map((a: any) => a.user_id);
          const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, full_name, whatsapp')
            .in('id', adminIds)
            .not('whatsapp', 'is', null);

          if (profiles) {
            recipients = profiles.map((p: any) => ({
              id: null,
              whatsapp: p.whatsapp,
              full_name: p.full_name,
            }));
          }
        }
      }
    }

    if (recipients.length === 0) {
      console.log('⚠️ No active recipients found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active recipients', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Found ${recipients.length} recipients`);

    // ========== CALCULAR MÉTRICAS ==========
    const metrics = await calculateMetrics(supabaseClient);
    const reportDate = new Date();
    const message = formatReportMessage(metrics, reportDate);

    console.log('📊 Metrics calculated:', {
      totalActive: metrics.totalActive,
      totalValue: metrics.totalValue,
      onTimeRate: metrics.sla.onTimeRate,
      alerts: metrics.alerts,
    });

    // ========== GERAR GRÁFICOS ==========
    let distributionChart: string | null = null;
    let trendChart: string | null = null;
    let slaGauge: string | null = null;

    if (includeChart) {
      console.log('🎨 Generating charts...');
      
      // Gerar gráfico de distribuição (sempre)
      distributionChart = await generateDistributionChart(metrics);
      if (distributionChart) console.log('✅ Distribution chart generated');
      
      // Gerar gráficos adicionais se solicitado
      if (includeAllCharts) {
        trendChart = await generateTrendChart(metrics);
        if (trendChart) console.log('✅ Trend chart generated');
        
        slaGauge = await generateSLAGauge(metrics);
        if (slaGauge) console.log('✅ SLA gauge generated');
      }
    }

    // ========== ENVIAR PARA DESTINATÁRIOS ==========
    let sentCount = 0;
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        // Enviar mensagem de texto
        const messageSent = await sendWhatsAppMessage(supabaseClient, recipient.whatsapp, message);
        
        // Enviar gráficos
        let chartsSent = 0;
        if (messageSent) {
          if (distributionChart) {
            const sent = await sendWhatsAppImage(
              supabaseClient,
              recipient.whatsapp,
              distributionChart,
              '📊 Distribuição por Fase'
            );
            if (sent) chartsSent++;
          }
          
          if (trendChart) {
            const sent = await sendWhatsAppImage(
              supabaseClient,
              recipient.whatsapp,
              trendChart,
              '📈 Tendência Semanal'
            );
            if (sent) chartsSent++;
          }
          
          if (slaGauge) {
            const sent = await sendWhatsAppImage(
              supabaseClient,
              recipient.whatsapp,
              slaGauge,
              '🎯 Taxa de Cumprimento SLA'
            );
            if (sent) chartsSent++;
          }
        }

        // Log do relatório
        if (!testMode) {
          await supabaseClient.from('management_report_log').insert({
            report_type: 'daily',
            recipient_id: recipient.id,
            recipient_whatsapp: recipient.whatsapp,
            message_content: message,
            chart_sent: chartsSent > 0,
            metrics_snapshot: metrics,
            status: messageSent ? 'sent' : 'failed',
          });

          // Atualizar last_report_sent_at
          if (recipient.id) {
            await supabaseClient
              .from('management_report_recipients')
              .update({ last_report_sent_at: new Date().toISOString() })
              .eq('id', recipient.id);
          }
        }

        if (messageSent) {
          sentCount++;
          console.log(`✅ Report sent to ${recipient.full_name} (${recipient.whatsapp}) with ${chartsSent} charts`);
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error sending to ${recipient.whatsapp}:`, error);
        errorCount++;
      }
    }

    console.log(`📊 Report complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        errorCount,
        metrics: {
          totalActive: metrics.totalActive,
          totalValue: metrics.totalValue,
          onTimeRate: metrics.sla.onTimeRate,
          alerts: metrics.alerts,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in daily report:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
