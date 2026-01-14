import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== TIPOS ====================
interface OrderMetrics {
  totalActive: number;
  totalValue: number;
  newToday: number;
  sla: { onTimeRate: number; onTimeCount: number; lateCount: number; criticalCount: number; lateValue: number };
  alerts: { delayed: number; critical: number; pendingLab: number; pendingPurchase: number };
  byPhase: Record<string, number>;
  phaseDetails: Array<{ phase: string; phaseKey: string; count: number }>;
}

interface ExtendedMetrics {
  // Saúde do Portfólio
  healthBreakdown: {
    onTime: number;
    delayed1to7: number;
    delayed8to30: number;
    delayedOver30: number;
  };
  
  // Extremamente atrasados (>30 dias)
  extremelyDelayed: Array<{
    order_number: string;
    customer_name: string;
    daysLate: number;
    value: number;
    status: string;
    statusLabel: string;
  }>;
  
  // Análise por fase
  phaseAnalysis: {
    compras: { count: number; avgDays: number; maxDelay: number; stuckValue: number; orders: any[] };
    producaoClientes: { count: number; avgDays: number; value: number; orders: any[] };
    producaoEstoque: { count: number; avgDays: number; value: number; orders: any[] };
  };
  
  // Tendências vs semana anterior
  weeklyTrend: {
    newOrders: number;
    newOrdersChange: number;
    delivered: number;
    deliveredChange: number;
    value: number;
    valueChange: number;
    dateChanges: number;
  };
  
  // Produção
  productionTime: {
    avg: number;
    min: number;
    max: number;
    endingToday: number;
  };
  
  // Top pedidos com detalhes
  topOrdersDetailed: Array<{
    order_number: string;
    customer_name: string;
    value: number;
    status: string;
    statusLabel: string;
    daysLate: number;
  }>;
  
  // Pedidos urgentes e atrasados
  urgentOrders: any[];
  delayedOrders: any[];
}

// ==================== CONSTANTES ====================
const DELAY_BETWEEN_SENDS_MS = 3000;
const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const statusToPhase: Record<string, string> = {
  'almox_ssm_pending': 'almoxSsm', 'almox_ssm_received': 'almoxSsm',
  'order_generation_pending': 'gerarOrdem', 'order_in_creation': 'gerarOrdem',
  'purchase_pending': 'compras', 'purchase_quoted': 'compras', 'purchase_ordered': 'compras',
  'almox_general_received': 'almoxGeral', 'almox_general_separating': 'almoxGeral',
  'separation_started': 'producao', 'in_production': 'producao', 'awaiting_material': 'producao',
  'awaiting_lab': 'laboratorio', 'in_lab_analysis': 'laboratorio',
  'in_quality_check': 'embalagem', 'in_packaging': 'embalagem', 'ready_for_shipping': 'embalagem',
  'freight_quote_requested': 'cotacao', 'freight_quote_received': 'cotacao',
  'ready_to_invoice': 'aFaturar', 'invoice_requested': 'faturamento', 'awaiting_invoice': 'faturamento',
  'released_for_shipping': 'expedicao', 'in_expedition': 'expedicao',
  'in_transit': 'emTransito', 'collected': 'emTransito',
  'delivered': 'conclusao', 'completed': 'conclusao',
};

const phaseLabels: Record<string, string> = {
  'almoxSsm': '📥 Almox SSM', 'gerarOrdem': '📋 Gerar Ordem', 'compras': '🛒 Compras',
  'almoxGeral': '📦 Almox Geral', 'producao': '🔧 Produção', 'laboratorio': '🔬 Laboratório',
  'embalagem': '📦 Embalagem', 'cotacao': '💰 Cotação', 'aFaturar': '💳 À Faturar',
  'faturamento': '🧾 Faturamento', 'expedicao': '🚛 Expedição', 'emTransito': '🚚 Em Trânsito',
  'conclusao': '✅ Conclusão',
};

const statusLabels: Record<string, string> = {
  'almox_ssm_pending': '📥 Almox SSM',
  'almox_ssm_received': '📥 Almox SSM',
  'order_generation_pending': '📋 Gerar Ordem',
  'order_in_creation': '📋 Gerar Ordem',
  'purchase_pending': '🛒 Compras',
  'purchase_quoted': '🛒 Compras',
  'purchase_ordered': '🛒 Compras',
  'almox_general_received': '📦 Almox Geral',
  'almox_general_separating': '📦 Almox Geral',
  'separation_started': '🔧 Em Produção',
  'in_production': '🔧 Em Produção',
  'awaiting_material': '🔧 Aguard. Material',
  'awaiting_lab': '🔬 Laboratório',
  'in_lab_analysis': '🔬 Laboratório',
  'in_quality_check': '📦 Qualidade',
  'in_packaging': '📦 Embalagem',
  'ready_for_shipping': '📦 Pronto Envio',
  'freight_quote_requested': '💰 Cotação',
  'freight_quote_received': '💰 Cotação',
  'ready_to_invoice': '💳 À Faturar',
  'invoice_requested': '🧾 Faturamento',
  'awaiting_invoice': '🧾 Faturamento',
  'released_for_shipping': '🚛 Expedição',
  'in_expedition': '🚛 Expedição',
  'in_transit': '🚚 Em Trânsito',
  'collected': '🚚 Coletado',
  'delivered': '✅ Entregue',
  'completed': '✅ Concluído',
};

// ==================== HELPERS ====================
function getSlaEmoji(rate: number): string {
  if (rate >= 85) return '✅';
  if (rate >= 70) return '⚠️';
  return '🔴';
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function formatTrend(change: number): string {
  if (change > 0) return `+${change}% ↑`;
  if (change < 0) return `${change}% ↓`;
  return '0%';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Ajustar horário para Brasília (UTC-3)
function getBrazilDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3 em minutos
  const utcOffset = now.getTimezoneOffset();
  const brazilTime = new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);
  
  const dateStr = brazilTime.toLocaleDateString('pt-BR', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const timeStr = brazilTime.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', minute: '2-digit' 
  });
  return { dateStr, timeStr };
}

function getStatusLabel(status: string): string {
  return statusLabels[status] || status;
}

// ==================== CÁLCULOS ====================
async function calculateMetrics(supabase: any): Promise<OrderMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, created_at, order_type, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  console.log(`📦 Found ${activeOrders.length} active orders`);

  const byPhase: Record<string, number> = {};
  let totalValue = 0, newToday = 0, onTimeCount = 0, lateCount = 0, criticalCount = 0, lateValue = 0;
  let pendingLab = 0, pendingPurchase = 0;

  activeOrders.forEach((order: any) => {
    const status = order.status || 'unknown';
    const phaseKey = statusToPhase[status] || 'conclusao';
    byPhase[phaseKey] = (byPhase[phaseKey] || 0) + 1;

    const orderValue = (order.order_items || []).reduce((sum: number, item: any) => {
      return sum + Number(item.total_value || (item.unit_price * item.requested_quantity) || 0);
    }, 0);
    totalValue += orderValue;

    const createdAt = new Date(order.created_at);
    if (createdAt >= today) newToday++;

    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0) {
        onTimeCount++;
        if (daysUntil <= 2) criticalCount++;
      } else {
        lateCount++;
        lateValue += orderValue;
      }
    }

    if (status.includes('lab')) pendingLab++;
    if (status.includes('purchase') || status === 'awaiting_material') pendingPurchase++;
  });

  const total = onTimeCount + lateCount;
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  const phaseDetails = Object.entries(byPhase)
    .filter(([_, count]) => count > 0)
    .map(([phaseKey, count]) => ({
      phase: phaseLabels[phaseKey] || phaseKey,
      phaseKey,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalActive: activeOrders.length,
    totalValue,
    newToday,
    sla: { onTimeRate, onTimeCount, lateCount, criticalCount, lateValue },
    alerts: { delayed: lateCount, critical: criticalCount, pendingLab, pendingPurchase },
    byPhase,
    phaseDetails,
  };
}

// ==================== MÉTRICAS ESTENDIDAS ====================
async function calculateExtendedMetrics(supabase: any): Promise<ExtendedMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Buscar pedidos ativos com detalhes
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, created_at, updated_at, order_type, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];

  // Buscar pedidos criados na última semana
  const { data: lastWeekNewOrders } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', weekAgo.toISOString())
    .lt('created_at', today.toISOString());

  // Buscar pedidos criados na semana anterior (para comparativo)
  const { data: previousWeekNewOrders } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', weekAgo.toISOString());

  // Buscar entregas da última semana
  const { data: lastWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'delivered')
    .gte('updated_at', weekAgo.toISOString());

  const { data: previousWeekDelivered } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'delivered')
    .gte('updated_at', twoWeeksAgo.toISOString())
    .lt('updated_at', weekAgo.toISOString());

  // Buscar mudanças de prazo
  const { data: dateChanges } = await supabase
    .from('delivery_date_changes')
    .select('id')
    .gte('changed_at', weekAgo.toISOString());

  // Processar pedidos
  const ordersWithDetails = activeOrders.map((order: any) => {
    const value = (order.order_items || []).reduce((sum: number, item: any) => {
      return sum + Number(item.total_value || (item.unit_price * item.requested_quantity) || 0);
    }, 0);

    let daysLate = 0;
    let daysUntil = null;
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) daysLate = Math.abs(daysUntil);
    }

    // Calcular dias na fase atual
    const updatedAt = new Date(order.updated_at || order.created_at);
    const daysInPhase = Math.floor((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...order,
      value,
      daysLate,
      daysUntil,
      daysInPhase,
      statusLabel: getStatusLabel(order.status),
      phaseKey: statusToPhase[order.status] || 'unknown',
    };
  });

  // === SAÚDE DO PORTFÓLIO ===
  const healthBreakdown = {
    onTime: ordersWithDetails.filter((o: any) => o.daysLate === 0).length,
    delayed1to7: ordersWithDetails.filter((o: any) => o.daysLate > 0 && o.daysLate <= 7).length,
    delayed8to30: ordersWithDetails.filter((o: any) => o.daysLate > 7 && o.daysLate <= 30).length,
    delayedOver30: ordersWithDetails.filter((o: any) => o.daysLate > 30).length,
  };

  // === EXTREMAMENTE ATRASADOS (>30 dias) ===
  const extremelyDelayed = ordersWithDetails
    .filter((o: any) => o.daysLate > 30)
    .sort((a: any, b: any) => b.daysLate - a.daysLate)
    .map((o: any) => ({
      order_number: o.order_number,
      customer_name: o.customer_name,
      daysLate: o.daysLate,
      value: o.value,
      status: o.status,
      statusLabel: o.statusLabel,
    }));

  // === ANÁLISE POR FASE ===
  // Compras
  const comprasOrders = ordersWithDetails.filter((o: any) => o.phaseKey === 'compras');
  const comprasAnalysis = {
    count: comprasOrders.length,
    avgDays: comprasOrders.length > 0 
      ? Math.round(comprasOrders.reduce((sum: number, o: any) => sum + o.daysInPhase, 0) / comprasOrders.length)
      : 0,
    maxDelay: comprasOrders.length > 0 
      ? Math.max(...comprasOrders.map((o: any) => o.daysLate))
      : 0,
    stuckValue: comprasOrders.reduce((sum: number, o: any) => sum + o.value, 0),
    orders: comprasOrders.sort((a: any, b: any) => b.daysLate - a.daysLate).slice(0, 5),
  };

  // Produção Clientes
  const prodClientesOrders = ordersWithDetails.filter((o: any) => 
    o.phaseKey === 'producao' && o.order_type !== 'estoque'
  );
  const prodClientesAnalysis = {
    count: prodClientesOrders.length,
    avgDays: prodClientesOrders.length > 0
      ? Math.round(prodClientesOrders.reduce((sum: number, o: any) => sum + o.daysInPhase, 0) / prodClientesOrders.length * 10) / 10
      : 0,
    value: prodClientesOrders.reduce((sum: number, o: any) => sum + o.value, 0),
    orders: prodClientesOrders.sort((a: any, b: any) => b.daysInPhase - a.daysInPhase).slice(0, 5)
      .map((o: any) => ({ order_number: o.order_number, days: o.daysInPhase })),
  };

  // Produção Estoque
  const prodEstoqueOrders = ordersWithDetails.filter((o: any) => 
    o.phaseKey === 'producao' && o.order_type === 'estoque'
  );
  const prodEstoqueAnalysis = {
    count: prodEstoqueOrders.length,
    avgDays: prodEstoqueOrders.length > 0
      ? Math.round(prodEstoqueOrders.reduce((sum: number, o: any) => sum + o.daysInPhase, 0) / prodEstoqueOrders.length * 10) / 10
      : 0,
    value: prodEstoqueOrders.reduce((sum: number, o: any) => sum + o.value, 0),
    orders: prodEstoqueOrders.sort((a: any, b: any) => b.daysInPhase - a.daysInPhase).slice(0, 5)
      .map((o: any) => ({ order_number: o.order_number, days: o.daysInPhase })),
  };

  // === TENDÊNCIAS ===
  const lastWeekNewCount = lastWeekNewOrders?.length || 0;
  const previousWeekNewCount = previousWeekNewOrders?.length || 0;
  const lastWeekDeliveredCount = lastWeekDelivered?.length || 0;
  const previousWeekDeliveredCount = previousWeekDelivered?.length || 0;

  // Calcular valor da semana
  const lastWeekValue = ordersWithDetails
    .filter((o: any) => new Date(o.created_at) >= weekAgo)
    .reduce((sum: number, o: any) => sum + o.value, 0);

  const weeklyTrend = {
    newOrders: lastWeekNewCount,
    newOrdersChange: previousWeekNewCount > 0 
      ? Math.round(((lastWeekNewCount - previousWeekNewCount) / previousWeekNewCount) * 100)
      : 0,
    delivered: lastWeekDeliveredCount,
    deliveredChange: previousWeekDeliveredCount > 0
      ? Math.round(((lastWeekDeliveredCount - previousWeekDeliveredCount) / previousWeekDeliveredCount) * 100)
      : 0,
    value: lastWeekValue,
    valueChange: 0, // Simplificado
    dateChanges: dateChanges?.length || 0,
  };

  // === PRODUÇÃO TIME ===
  const allProductionOrders = ordersWithDetails.filter((o: any) => 
    ['producao', 'laboratorio', 'embalagem'].includes(o.phaseKey)
  );
  const productionDays = allProductionOrders.map((o: any) => o.daysInPhase);
  
  const productionTime = {
    avg: productionDays.length > 0 ? Math.round(productionDays.reduce((a: number, b: number) => a + b, 0) / productionDays.length) : 0,
    min: productionDays.length > 0 ? Math.min(...productionDays) : 0,
    max: productionDays.length > 0 ? Math.max(...productionDays) : 0,
    endingToday: ordersWithDetails.filter((o: any) => o.daysUntil === 0).length,
  };

  // === TOP PEDIDOS DETALHADOS ===
  const topOrdersDetailed = ordersWithDetails
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5)
    .map((o: any) => ({
      order_number: o.order_number,
      customer_name: o.customer_name,
      value: o.value,
      status: o.status,
      statusLabel: o.statusLabel,
      daysLate: o.daysLate,
    }));

  // === URGENTES E ATRASADOS ===
  const urgentOrders = ordersWithDetails
    .filter((o: any) => o.daysUntil !== null && o.daysUntil >= 0 && o.daysUntil <= 2)
    .sort((a: any, b: any) => a.daysUntil - b.daysUntil);

  const delayedOrders = ordersWithDetails
    .filter((o: any) => o.daysLate > 0)
    .sort((a: any, b: any) => b.daysLate - a.daysLate);

  return {
    healthBreakdown,
    extremelyDelayed,
    phaseAnalysis: {
      compras: comprasAnalysis,
      producaoClientes: prodClientesAnalysis,
      producaoEstoque: prodEstoqueAnalysis,
    },
    weeklyTrend,
    productionTime,
    topOrdersDetailed,
    urgentOrders,
    delayedOrders,
  };
}

// ==================== FORMATAÇÃO ====================

// Relatório COMPLETO com todas as métricas detalhadas
function formatFullReport(metrics: OrderMetrics, extended: ExtendedMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `📊 *RELATÓRIO GERENCIAL DIÁRIO*\n`;
  msg += `📅 ${dateStr} • ${timeStr} (Brasília)\n\n`;
  
  // ━━━ RESUMO EXECUTIVO ━━━
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 *RESUMO EXECUTIVO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `• Pedidos Ativos: *${metrics.totalActive}*\n`;
  msg += `• Valor em Produção: *${formatCurrency(metrics.totalValue)}*\n`;
  msg += `• Taxa de Cumprimento: *${metrics.sla.onTimeRate}%* ${getSlaEmoji(metrics.sla.onTimeRate)}\n`;
  msg += `• Novos Hoje: *${metrics.newToday}*\n\n`;
  
  // ━━━ ALERTAS CRÍTICOS ━━━
  msg += `🚨 *ALERTAS CRÍTICOS*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚠️ *${metrics.alerts.delayed}* pedidos ATRASADOS (${formatCurrency(metrics.sla.lateValue)})\n`;
  msg += `🔴 *${metrics.alerts.critical}* pedidos críticos (< 48h)\n`;
  if (metrics.alerts.pendingLab > 0) msg += `🔬 *${metrics.alerts.pendingLab}* aguardando Laboratório\n`;
  if (metrics.alerts.pendingPurchase > 0) msg += `🛒 *${metrics.alerts.pendingPurchase}* aguardando Compras/Material\n`;
  msg += `\n`;
  
  // ━━━ PEDIDOS EXTREMAMENTE ATRASADOS ━━━
  if (extended.extremelyDelayed.length > 0) {
    msg += `🆘 *PEDIDOS EXTREMAMENTE ATRASADOS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚠️ *${extended.extremelyDelayed.length}* pedidos com mais de 30 dias de atraso:\n\n`;
    extended.extremelyDelayed.slice(0, 5).forEach((order, idx) => {
      msg += `${idx + 1}. *#${order.order_number}* - ${order.daysLate}d atrasado\n`;
      msg += `   ${formatCurrency(order.value)} | ${order.statusLabel}\n`;
    });
    if (extended.extremelyDelayed.length > 5) {
      msg += `_... e mais ${extended.extremelyDelayed.length - 5} pedidos_\n`;
    }
    msg += `\n`;
  }
  
  // ━━━ SAÚDE DO PORTFÓLIO ━━━
  const health = extended.healthBreakdown;
  const totalHealth = health.onTime + health.delayed1to7 + health.delayed8to30 + health.delayedOver30;
  msg += `🩺 *SAÚDE DO PORTFÓLIO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✅ Dentro do prazo: *${health.onTime}* (${pct(health.onTime, totalHealth)}%)\n`;
  msg += `⚠️ 1-7 dias atrasados: *${health.delayed1to7}* (${pct(health.delayed1to7, totalHealth)}%)\n`;
  msg += `🔴 8-30 dias atrasados: *${health.delayed8to30}* (${pct(health.delayed8to30, totalHealth)}%)\n`;
  msg += `🆘 > 30 dias atrasados: *${health.delayedOver30}* (${pct(health.delayedOver30, totalHealth)}%)\n\n`;
  
  // ━━━ ANÁLISE DETALHADA - COMPRAS ━━━
  const compras = extended.phaseAnalysis.compras;
  if (compras.count > 0) {
    msg += `🛒 *ANÁLISE DETALHADA - COMPRAS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `• Total na fase: *${compras.count}* pedidos\n`;
    msg += `• Tempo médio na fase: *${compras.avgDays}* dias\n`;
    msg += `• Maior atraso: *${compras.maxDelay}* dias\n`;
    msg += `• Valor parado: *${formatCurrency(compras.stuckValue)}*\n`;
    if (compras.orders.length > 0) {
      msg += `📌 *Pedidos mais atrasados:*\n`;
      compras.orders.slice(0, 3).forEach((o: any) => {
        msg += `   #${o.order_number} - *${o.daysLate}d* atrasado (${formatCurrency(o.value)})\n`;
      });
    }
    if (compras.avgDays > 10) msg += `⚠️ *GARGALO:* Tempo médio acima do limite (10d)\n`;
    msg += `\n`;
  }
  
  // ━━━ ANÁLISE DETALHADA - PRODUÇÃO ━━━
  msg += `🔧 *ANÁLISE DETALHADA - PRODUÇÃO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  const prodClientes = extended.phaseAnalysis.producaoClientes;
  msg += `👥 *Produção Clientes:*\n`;
  msg += `• Pedidos: *${prodClientes.count}*\n`;
  msg += `• Tempo médio: *${prodClientes.avgDays}* dias\n`;
  msg += `• Valor: *${formatCurrency(prodClientes.value)}*\n`;
  if (prodClientes.orders.length > 0) {
    msg += `📌 Mais antigos: ${prodClientes.orders.slice(0, 3).map((o: any) => `#${o.order_number} (${o.days}d)`).join(', ')}\n`;
  }
  msg += `\n`;
  
  const prodEstoque = extended.phaseAnalysis.producaoEstoque;
  msg += `📦 *Produção Estoque:*\n`;
  msg += `• Pedidos: *${prodEstoque.count}*\n`;
  msg += `• Tempo médio: *${prodEstoque.avgDays}* dias\n`;
  msg += `• Valor: *${formatCurrency(prodEstoque.value)}*\n`;
  if (prodEstoque.orders.length > 0) {
    msg += `📌 Mais antigos: ${prodEstoque.orders.slice(0, 3).map((o: any) => `#${o.order_number} (${o.days}d)`).join(', ')}\n`;
  }
  if (prodClientes.avgDays > 7 || prodEstoque.avgDays > 7) {
    msg += `⚠️ *GARGALO:* Tempo médio de produção acima do limite (7d)\n`;
  }
  msg += `\n`;
  
  // ━━━ TENDÊNCIAS ━━━
  const trend = extended.weeklyTrend;
  msg += `📊 *TENDÊNCIAS (vs semana anterior)*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `• Novos: ${trend.newOrders} (${formatTrend(trend.newOrdersChange)})\n`;
  msg += `• Entregues: ${trend.delivered} (${formatTrend(trend.deliveredChange)})\n`;
  msg += `• Valor: ${formatCurrency(trend.value)} (${formatTrend(trend.valueChange)})\n`;
  msg += `• Mudanças de prazo: ${trend.dateChanges}\n\n`;
  
  // ━━━ DISTRIBUIÇÃO POR FASE ━━━
  msg += `📦 *DISTRIBUIÇÃO POR FASE*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  metrics.phaseDetails.forEach(p => {
    msg += `• ${p.phase}: *${p.count}*\n`;
  });
  msg += `\n`;
  
  // ━━━ TOP 5 PEDIDOS ━━━
  if (extended.topOrdersDetailed.length > 0) {
    msg += `💰 *TOP 5 PEDIDOS (MAIOR VALOR)*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    extended.topOrdersDetailed.slice(0, 5).forEach((order, idx) => {
      const customerShort = order.customer_name?.substring(0, 25) || 'N/A';
      msg += `${idx + 1}. *${order.order_number}* - ${customerShort}\n`;
      msg += `   ${formatCurrency(order.value)} | ${order.statusLabel}`;
      if (order.daysLate > 0) msg += ` | ⚠️ ${order.daysLate}d atrasado`;
      msg += `\n`;
    });
    msg += `\n`;
  }
  
  // ━━━ TEMPO EM PRODUÇÃO ━━━
  const prod = extended.productionTime;
  msg += `🔧 *TEMPO EM PRODUÇÃO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `• Média: ${prod.avg} dias\n`;
  msg += `• Mín/Máx: ${prod.min}/${prod.max} dias\n`;
  msg += `• Vencem hoje: ${prod.endingToday}\n\n`;
  
  // Rodapé
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 _Relatório gerado às ${timeStr} (Brasília)_\n`;
  msg += `_Sistema de Gestão Imply_`;
  
  return msg;
}

// Relatório RESUMO (rápido)
function formatSummaryReport(metrics: OrderMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `📋 *RESUMO RÁPIDO*\n`;
  msg += `📅 ${dateStr} • ${timeStr} (Brasília)\n\n`;
  
  msg += `📦 Ativos: *${metrics.totalActive}*\n`;
  msg += `💰 Valor: *${formatCurrency(metrics.totalValue)}*\n`;
  msg += `📊 SLA: *${metrics.sla.onTimeRate}%* ${getSlaEmoji(metrics.sla.onTimeRate)}\n\n`;
  
  msg += `📊 *POR FASE*\n`;
  metrics.phaseDetails.slice(0, 6).forEach(p => {
    msg += `• ${p.phase}: *${p.count}*\n`;
  });
  
  msg += `\n🤖 _Sistema Imply_`;
  return msg;
}

// Relatório URGENTES (entrega em 1-2 dias)
function formatUrgentReport(metrics: OrderMetrics, extended: ExtendedMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `🚨 *PEDIDOS URGENTES*\n`;
  msg += `📅 ${dateStr} • ${timeStr} (Brasília)\n\n`;
  
  msg += `⚡ *${metrics.alerts.critical}* pedidos com entrega em 1-2 dias!\n\n`;
  
  if (extended.urgentOrders.length > 0) {
    msg += `📋 *LISTA*\n`;
    extended.urgentOrders.slice(0, 10).forEach((order: any) => {
      const daysText = order.daysUntil === 0 ? 'HOJE' : order.daysUntil === 1 ? 'AMANHÃ' : `${order.daysUntil} dias`;
      msg += `• ${order.order_number} - ${order.customer_name?.substring(0, 20)}\n`;
      msg += `  📅 ${daysText} | ${formatCurrency(order.value)}\n`;
    });
  } else {
    msg += `✅ Nenhum pedido urgente no momento!\n`;
  }
  
  msg += `\n🤖 _Sistema Imply_`;
  return msg;
}

// Relatório ATRASADOS
function formatDelayedReport(metrics: OrderMetrics, extended: ExtendedMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `⏰ *PEDIDOS ATRASADOS*\n`;
  msg += `📅 ${dateStr} • ${timeStr} (Brasília)\n\n`;
  
  msg += `⚠️ *${metrics.alerts.delayed}* pedidos atrasados\n`;
  msg += `💰 Valor em risco: *${formatCurrency(metrics.sla.lateValue)}*\n\n`;
  
  if (extended.delayedOrders.length > 0) {
    msg += `📋 *TOP ATRASADOS*\n`;
    extended.delayedOrders.slice(0, 10).forEach((order: any) => {
      msg += `• ${order.order_number} - ${order.customer_name?.substring(0, 20)}\n`;
      msg += `  📅 ${order.daysLate} dias | ${formatCurrency(order.value)}\n`;
    });
  } else {
    msg += `✅ Nenhum pedido atrasado!\n`;
  }
  
  msg += `\n🤖 _Sistema Imply_`;
  return msg;
}

// Relatório POR FASE
function formatPhaseReport(metrics: OrderMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `📊 *DISTRIBUIÇÃO POR FASE*\n`;
  msg += `📅 ${dateStr} • ${timeStr} (Brasília)\n\n`;
  
  msg += `📦 Total: *${metrics.totalActive}* pedidos ativos\n\n`;
  
  metrics.phaseDetails.forEach(p => {
    const pctValue = pct(p.count, metrics.totalActive);
    const bar = '█'.repeat(Math.ceil(pctValue / 10));
    msg += `${p.phase}\n  *${p.count}* (${pctValue}%) ${bar}\n\n`;
  });
  
  msg += `🤖 _Sistema Imply_`;
  return msg;
}

// Função principal que seleciona o formato correto
function formatReport(
  metrics: OrderMetrics, 
  extended: ExtendedMetrics,
  reportType: string
): string {
  switch (reportType) {
    case 'full':
      return formatFullReport(metrics, extended);
    case 'summary':
      return formatSummaryReport(metrics);
    case 'urgent':
      return formatUrgentReport(metrics, extended);
    case 'delayed':
      return formatDelayedReport(metrics, extended);
    case 'phase_summary':
      return formatPhaseReport(metrics);
    default:
      return formatFullReport(metrics, extended);
  }
}

// ==================== WHATSAPP ====================
async function getActiveInstance(supabase: any) {
  let { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_key, api_token, status, connected_at')
    .eq('status', 'connected')
    .eq('is_active', true)
    .maybeSingle();

  if (!instance) {
    const { data: fallback } = await supabase
      .from('whatsapp_instances')
      .select('instance_key, api_token, status, connected_at')
      .eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .maybeSingle();
    instance = fallback;
  }
  return instance;
}

function isPlaceholderToken(token: string | null | undefined): boolean {
  if (!token || token.trim() === '') return true;
  const placeholders = ['SEU_TOKEN', 'API_KEY', 'YOUR_TOKEN', 'TOKEN_AQUI', 'PLACEHOLDER'];
  return placeholders.some(p => token.toUpperCase().includes(p));
}

function getPhoneVariants(phone: string): string[] {
  let canonical = phone.replace(/\D/g, '');
  if (!canonical.startsWith('55')) canonical = `55${canonical}`;
  
  if (canonical.length === 13 && canonical[4] === '9') {
    canonical = canonical.slice(0, 4) + canonical.slice(5);
  }
  
  const without9 = canonical;
  const with9 = canonical.slice(0, 4) + '9' + canonical.slice(4);
  
  return [without9, with9];
}

async function tryMultiHeaderFetch(
  url: string,
  token: string,
  body: any
): Promise<Response | null> {
  const headerTypes = ['apikey', 'Bearer', 'Apikey'];
  
  for (const headerType of headerTypes) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (headerType === 'apikey') {
      headers['apikey'] = token;
    } else if (headerType === 'Bearer') {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Apikey'] = token;
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        console.log(`✅ Success with header format: ${headerType}`);
        return response;
      }
      
      if (response.status === 401 || response.status === 403) {
        console.log(`🔄 Auth failed with ${headerType} (${response.status}), trying next...`);
        continue;
      }
      
      return response;
    } catch (err) {
      console.error(`❌ Fetch error with ${headerType}:`, err);
      continue;
    }
  }
  
  return null;
}

function getEffectiveToken(dbToken: string | null | undefined): string {
  if (dbToken && !isPlaceholderToken(dbToken)) {
    console.log('🔑 Using database token');
    return dbToken;
  }
  
  const envToken = Deno.env.get('MEGA_API_TOKEN') || '';
  if (envToken && !isPlaceholderToken(envToken)) {
    console.log('🔑 Database token invalid, using MEGA_API_TOKEN from env');
    return envToken;
  }
  
  console.error('❌ No valid token available (db or env)');
  return '';
}

async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<boolean> {
  try {
    const instance = await getActiveInstance(supabase);
    if (!instance) {
      console.error('❌ No WhatsApp instance');
      return false;
    }

    const token = getEffectiveToken(instance.api_token);
    if (!token) {
      console.error('❌ No valid API token available');
      return false;
    }

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http')) megaApiUrl = `https://${megaApiUrl}`;
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const url = `${megaApiUrl}/rest/sendMessage/${instance.instance_key}/text`;
    const phoneVariants = getPhoneVariants(phone);

    console.log(`📤 Attempting to send to variants: ${phoneVariants.join(', ')} via ${instance.instance_key}`);

    for (let i = 0; i < phoneVariants.length; i++) {
      const phoneNumber = phoneVariants[i];
      const isLastVariant = i === phoneVariants.length - 1;
      
      console.log(`📲 Trying ${phoneNumber}...`);
      
      const body = { messageData: { to: phoneNumber, text: message, linkPreview: false } };
      
      const res = await tryMultiHeaderFetch(url, token, body);

      if (res?.ok) {
        console.log('✅ WhatsApp sent to:', phoneNumber);
        return true;
      }

      if (res) {
        const err = await res.text();
        console.warn(`⚠️ Failed for ${phoneNumber}: ${res.status} - ${err.substring(0, 100)}`);
        
        if ((res.status === 400 || res.status === 404) && !isLastVariant) {
          await delayMs(500);
          continue;
        }
        
        if (res.status === 401 || res.status === 403) {
          console.error('❌ Authentication failed with all header formats');
          return false;
        }
      } else {
        console.error(`❌ All header formats failed for ${phoneNumber}`);
      }
      
      if (isLastVariant) {
        return false;
      }
    }

    console.error('❌ All phone variants failed');
    return false;
  } catch (error) {
    console.error('❌ WhatsApp error:', error);
    return false;
  }
}

// ==================== EMAIL ====================
async function sendEmail(email: string, name: string, subject: string, content: string): Promise<boolean> {
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return false;

    const resend = new Resend(RESEND_API_KEY);
    const html = content.replace(/\n/g, '<br>').replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

    const { data, error } = await resend.emails.send({
      from: 'Imply Gestão <onboarding@resend.dev>',
      to: email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">${html}</div>`,
    });

    if (error) {
      console.error('❌ Email error:', error);
      return false;
    }
    console.log('✅ Email sent:', email, data?.id);
    return true;
  } catch (error) {
    console.error('❌ Email exception:', error);
    return false;
  }
}

// ==================== HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting daily report...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parâmetros do request
    let testMode = false, testPhone = null, testEmail = null, sendEmailFlag = true;
    let reportType = 'full';
    
    try {
      const body = await req.json();
      testMode = body.testMode === true;
      testPhone = body.testPhone;
      testEmail = body.testEmail;
      sendEmailFlag = body.sendEmail !== false;
      reportType = body.reportType || 'full';
    } catch { /* No body */ }

    console.log(`📋 Report type: ${reportType}`);

    // Buscar destinatários
    let recipients: any[] = [];
    
    if (testMode) {
      const { data: config } = await supabase
        .from('ai_agent_config')
        .select('test_phones, test_phone')
        .maybeSingle();
      
      const phones = testPhone ? [testPhone] : (config?.test_phones || (config?.test_phone ? [config.test_phone] : []));
      recipients = phones.map((p: string) => ({ whatsapp: p, email: testEmail, full_name: 'Teste' }));
      
      if (recipients.length === 0 && testEmail) {
        recipients = [{ whatsapp: null, email: testEmail, full_name: 'Teste' }];
      }
    } else {
      const { data: recipientsData } = await supabase
        .from('management_report_recipients')
        .select('id, whatsapp, profiles:user_id(full_name, email)')
        .eq('is_active', true)
        .contains('report_types', ['daily']);

      if (recipientsData?.length) {
        recipients = recipientsData.map((r: any) => ({
          id: r.id,
          whatsapp: r.whatsapp,
          email: r.profiles?.email,
          full_name: r.profiles?.full_name || 'Gestor',
        }));
      }
    }

    if (recipients.length === 0) {
      console.log('⚠️ No recipients found');
      return new Response(JSON.stringify({ success: true, message: 'No recipients', sentCount: 0 }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📬 Sending to ${recipients.length} recipients`);

    // Calcular métricas básicas e estendidas
    const metrics = await calculateMetrics(supabase);
    const extendedMetrics = await calculateExtendedMetrics(supabase);
    
    const message = formatReport(metrics, extendedMetrics, reportType);

    console.log('📊 Metrics:', { 
      totalActive: metrics.totalActive, 
      sla: metrics.sla.onTimeRate, 
      reportType,
      extremelyDelayed: extendedMetrics.extremelyDelayed.length,
      topOrders: extendedMetrics.topOrdersDetailed.length
    });

    // Verificar conexão
    const instance = await getActiveInstance(supabase);
    if (!instance) {
      console.error('❌ No WhatsApp connected');
      return new Response(JSON.stringify({ success: false, error: 'WhatsApp não conectado' }), 
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Enviar
    let sentCount = 0, emailCount = 0, errorCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      
      if (r.whatsapp) {
        const sent = await sendWhatsApp(supabase, r.whatsapp, message);
        if (sent) sentCount++;
        else errorCount++;
        
        // Log
        await supabase.from('management_report_log').insert({
          recipient_id: r.id,
          recipient_whatsapp: r.whatsapp,
          report_type: reportType,
          status: sent ? 'sent' : 'failed',
          message_content: message.substring(0, 500),
          metrics_snapshot: { 
            totalActive: metrics.totalActive, 
            sla: metrics.sla.onTimeRate, 
            reportType,
            extremelyDelayed: extendedMetrics.extremelyDelayed.length
          },
        });
      }

      if (sendEmailFlag && r.email) {
        const { dateStr } = getBrazilDateTime();
        const sent = await sendEmail(r.email, r.full_name, `📊 Relatório Gerencial - ${dateStr}`, message);
        if (sent) emailCount++;
      }

      if (i < recipients.length - 1 && r.whatsapp) {
        await delayMs(DELAY_BETWEEN_SENDS_MS);
      }
    }

    console.log(`📊 Done: ${sentCount} WhatsApp, ${emailCount} emails, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount, 
        emailCount, 
        errorCount, 
        reportType,
        metrics: { 
          totalActive: metrics.totalActive, 
          sla: metrics.sla.onTimeRate,
          extremelyDelayed: extendedMetrics.extremelyDelayed.length,
          healthBreakdown: extendedMetrics.healthBreakdown
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
