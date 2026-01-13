import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
  
  // Distribuição por Fase (TODAS as 15 fases do Kanban)
  byPhase: {
    almoxSsm: number;
    gerarOrdem: number;
    compras: number;
    almoxGeral: number;
    producaoClientes: number;
    producaoEstoque: number;
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
    daysOverdue: number;
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

  // Análise detalhada de fases críticas
  criticalPhaseAnalysis: {
    compras: {
      count: number;
      avgDays: number;
      maxDays: number;
      maxDaysOverdue: number;
      totalValue: number;
      awaitingMaterial: number;
      oldestOrders: Array<{
        orderNumber: string;
        customer: string;
        daysInPhase: number;
        daysOverdue: number;
        value: number;
      }>;
    };
    producaoClientes: {
      count: number;
      avgDays: number;
      maxDays: number;
      totalValue: number;
      oldestOrders: Array<{
        orderNumber: string;
        customer: string;
        daysInPhase: number;
        value: number;
      }>;
    };
    producaoEstoque: {
      count: number;
      avgDays: number;
      maxDays: number;
      totalValue: number;
      oldestOrders: Array<{
        orderNumber: string;
        customer: string;
        daysInPhase: number;
        value: number;
      }>;
    };
  };

  // Pedidos extremamente atrasados (>30 dias)
  extremelyOverdueOrders: Array<{
    orderNumber: string;
    customer: string;
    daysOverdue: number;
    value: number;
    phase: string;
    phaseLabel: string;
  }>;

  // Saúde do Portfólio
  portfolioHealth: {
    onTime: { count: number; percentage: number };
    late1to7: { count: number; percentage: number };
    late8to30: { count: number; percentage: number };
    lateOver30: { count: number; percentage: number };
  };
}

// Interface para gestor de fase
interface PhaseManager {
  user_id: string;
  phase_key: string;
  whatsapp: string;
  email?: string;
  full_name: string;
  receive_daily_summary: boolean;
}

// ==================== MAPEAMENTOS ====================
const statusToPhaseBase: Record<string, string> = {
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

// Mapeamento de phase_key do banco para chave interna
const phaseKeyDbToInternal: Record<string, string> = {
  'almox_ssm': 'almoxSsm',
  'order_generation': 'gerarOrdem',
  'purchases': 'compras',
  'almox_general': 'almoxGeral',
  'production_client': 'producaoClientes',
  'production_stock': 'producaoEstoque',
  'balance_generation': 'gerarSaldo',
  'laboratory': 'laboratorio',
  'packaging': 'embalagem',
  'freight_quote': 'cotacao',
  'ready_to_invoice': 'aFaturar',
  'invoicing': 'faturamento',
  'logistics': 'expedicao',
  'in_transit': 'emTransito',
  'completion': 'conclusao',
};

function getPhaseFromOrder(status: string, orderCategory: string): string {
  const basePhase = statusToPhaseBase[status] || 'conclusao';
  
  if (basePhase === 'producao') {
    return orderCategory === 'vendas' ? 'producaoClientes' : 'producaoEstoque';
  }
  
  return basePhase;
}

const phaseLabels: Record<string, string> = {
  'almoxSsm': '📥 Almox SSM',
  'gerarOrdem': '📋 Gerar Ordem',
  'compras': '🛒 Compras',
  'almoxGeral': '📦 Almox Geral',
  'producaoClientes': '🔧 Produção Clientes',
  'producaoEstoque': '📦 Produção Estoque',
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

const phaseOrder: string[] = [
  'almoxSsm',
  'gerarOrdem', 
  'compras',
  'almoxGeral',
  'producaoClientes',
  'producaoEstoque',
  'gerarSaldo',
  'laboratorio',
  'embalagem',
  'cotacao',
  'aFaturar',
  'faturamento',
  'expedicao',
  'emTransito',
  'conclusao',
];

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
  'producaoClientes': 7,
  'producaoEstoque': 7,
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

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, status, order_category, order_type,
      delivery_date, created_at, updated_at,
      order_items(id, item_code, item_status, unit_price, requested_quantity, total_value)
    `)
    .not('status', 'in', '("completed","cancelled","delivered")');

  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError);
  }

  const activeOrders = orders || [];
  console.log(`📦 Found ${activeOrders.length} active orders`);

  const orderIds = activeOrders.map((o: any) => o.id);
  let lastStatusChangeMap: Record<string, Date> = {};
  
  if (orderIds.length > 0) {
    const { data: historyData, error: historyError } = await supabase
      .from('order_history')
      .select('order_id, new_status, changed_at')
      .in('order_id', orderIds)
      .order('changed_at', { ascending: false });

    if (historyError) {
      console.error('❌ Error fetching order history:', historyError);
    } else {
      console.log(`📜 Found ${historyData?.length || 0} history records`);
      
      activeOrders.forEach((order: any) => {
        const history = historyData?.filter((h: any) => h.order_id === order.id && h.new_status === order.status);
        if (history && history.length > 0) {
          lastStatusChangeMap[order.id] = new Date(history[0].changed_at);
        } else {
          lastStatusChangeMap[order.id] = new Date(order.created_at);
        }
      });
    }
  }

  const byPhase: OrderMetrics['byPhase'] = {
    almoxSsm: 0, 
    gerarOrdem: 0, 
    compras: 0, 
    almoxGeral: 0,
    producaoClientes: 0,
    producaoEstoque: 0,
    gerarSaldo: 0, 
    laboratorio: 0, 
    embalagem: 0,
    cotacao: 0, 
    aFaturar: 0, 
    faturamento: 0, 
    expedicao: 0,
    emTransito: 0, 
    conclusao: 0,
  };

  const phaseOrders: Record<string, any[]> = {};
  const phaseDays: Record<string, number[]> = {};
  const phaseValues: Record<string, number> = {};
  
  const criticalPhaseOrders: Record<string, any[]> = {
    compras: [],
    producaoClientes: [],
    producaoEstoque: [],
  };
  
  const allOrdersWithOverdue: any[] = [];
  let healthOnTime = 0;
  let healthLate1to7 = 0;
  let healthLate8to30 = 0;
  let healthLateOver30 = 0;
  
  let totalValue = 0;
  let newToday = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let criticalCount = 0;
  let lateValue = 0;
  let pendingLab = 0;
  let pendingPurchase = 0;
  let awaitingMaterial = 0;
  const productionDays: number[] = [];
  let startedToday = 0;
  let endingToday = 0;

  activeOrders.forEach((order: any) => {
    const status = order.status || 'unknown';
    const orderCategory = order.order_category || 'estoque';
    
    const phaseKey = getPhaseFromOrder(status, orderCategory);
    
    if (phaseKey in byPhase) {
      (byPhase as any)[phaseKey]++;
    }
    
    if (!phaseOrders[phaseKey]) phaseOrders[phaseKey] = [];
    if (!phaseDays[phaseKey]) phaseDays[phaseKey] = [];
    if (!phaseValues[phaseKey]) phaseValues[phaseKey] = 0;
    
    const phaseStartedAt = lastStatusChangeMap[order.id] || new Date(order.created_at);
    const daysInPhase = Math.ceil((today.getTime() - phaseStartedAt.getTime()) / (1000 * 60 * 60 * 24));
    phaseDays[phaseKey].push(daysInPhase);

    let daysUntilDelivery = 999;
    let daysOverdue = 0;
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      daysOverdue = daysUntilDelivery < 0 ? Math.abs(daysUntilDelivery) : 0;
    }

    const orderValue = (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
    totalValue += orderValue;
    phaseValues[phaseKey] = (phaseValues[phaseKey] || 0) + orderValue;
    
    (order as any).calculated_value = orderValue;
    (order as any).days_in_phase = daysInPhase;
    (order as any).days_overdue = daysOverdue;
    (order as any).phase_key = phaseKey;

    phaseOrders[phaseKey].push({
      orderNumber: order.order_number,
      customer: order.customer_name,
      daysUntil: daysUntilDelivery,
      daysInPhase: daysInPhase,
      daysOverdue: daysOverdue,
      value: orderValue,
    });

    if (phaseKey === 'compras' || phaseKey === 'producaoClientes' || phaseKey === 'producaoEstoque') {
      criticalPhaseOrders[phaseKey].push({
        orderNumber: order.order_number,
        customer: order.customer_name,
        daysInPhase: daysInPhase,
        daysOverdue: daysOverdue,
        value: orderValue,
        status: status,
      });
    }

    allOrdersWithOverdue.push({
      orderNumber: order.order_number,
      customer: order.customer_name,
      daysOverdue: daysOverdue,
      value: orderValue,
      phase: phaseKey,
      phaseLabel: phaseLabels[phaseKey] || phaseKey,
    });

    if (daysOverdue === 0) {
      healthOnTime++;
    } else if (daysOverdue >= 1 && daysOverdue <= 7) {
      healthLate1to7++;
    } else if (daysOverdue >= 8 && daysOverdue <= 30) {
      healthLate8to30++;
    } else if (daysOverdue > 30) {
      healthLateOver30++;
    }

    const createdAt = new Date(order.created_at);
    createdAt.setHours(0, 0, 0, 0);
    if (createdAt.getTime() === today.getTime()) {
      newToday++;
      startedToday++;
    }

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

    if (status === 'awaiting_lab' || status === 'in_lab_analysis') {
      pendingLab++;
    }
    if (status.startsWith('purchase_')) {
      pendingPurchase++;
    }
    if (status === 'awaiting_material') {
      awaitingMaterial++;
    }

    if (phaseKey === 'producaoClientes' || phaseKey === 'producaoEstoque') {
      productionDays.push(daysInPhase);
    }
  });

  const extremelyOverdueOrders = allOrdersWithOverdue
    .filter(o => o.daysOverdue > 30)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10);

  const totalOrders = activeOrders.length;
  const portfolioHealth = {
    onTime: { 
      count: healthOnTime, 
      percentage: totalOrders > 0 ? Math.round((healthOnTime / totalOrders) * 100) : 0 
    },
    late1to7: { 
      count: healthLate1to7, 
      percentage: totalOrders > 0 ? Math.round((healthLate1to7 / totalOrders) * 100) : 0 
    },
    late8to30: { 
      count: healthLate8to30, 
      percentage: totalOrders > 0 ? Math.round((healthLate8to30 / totalOrders) * 100) : 0 
    },
    lateOver30: { 
      count: healthLateOver30, 
      percentage: totalOrders > 0 ? Math.round((healthLateOver30 / totalOrders) * 100) : 0 
    },
  };

  const onTimeRate = activeOrders.length > 0 
    ? Math.round((onTimeCount / activeOrders.length) * 100) 
    : 100;

  const production = {
    avgDays: productionDays.length > 0 ? Math.round(productionDays.reduce((a, b) => a + b, 0) / productionDays.length) : 0,
    minDays: productionDays.length > 0 ? Math.min(...productionDays) : 0,
    maxDays: productionDays.length > 0 ? Math.max(...productionDays) : 0,
    medianDays: productionDays.length > 0 ? productionDays.sort((a, b) => a - b)[Math.floor(productionDays.length / 2)] : 0,
    startedToday,
    endingToday,
  };

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

  const calculateCriticalPhaseStats = (phaseKey: string, sortByOverdue: boolean = false) => {
    const orders = criticalPhaseOrders[phaseKey] || [];
    const days = phaseDays[phaseKey] || [];
    const value = phaseValues[phaseKey] || 0;
    
    const sortedOrders = sortByOverdue 
      ? [...orders].sort((a, b) => b.daysOverdue - a.daysOverdue)
      : [...orders].sort((a, b) => b.daysInPhase - a.daysInPhase);
    
    const maxDaysOverdue = orders.length > 0 
      ? Math.max(...orders.map((o: any) => o.daysOverdue || 0)) 
      : 0;
    
    return {
      count: orders.length,
      avgDays: days.length > 0 ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0,
      maxDays: days.length > 0 ? Math.max(...days) : 0,
      maxDaysOverdue: maxDaysOverdue,
      totalValue: value,
      awaitingMaterial: phaseKey === 'compras' ? awaitingMaterial : 0,
      oldestOrders: sortedOrders.slice(0, 3).map(o => ({
        orderNumber: o.orderNumber,
        customer: o.customer,
        daysInPhase: o.daysInPhase,
        daysOverdue: o.daysOverdue || 0,
        value: o.value,
      })),
    };
  };

  const criticalPhaseAnalysis = {
    compras: calculateCriticalPhaseStats('compras', true),
    producaoClientes: calculateCriticalPhaseStats('producaoClientes', false),
    producaoEstoque: calculateCriticalPhaseStats('producaoEstoque', false),
  };

  // Tendências semanais
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

  const { count: dateChanges } = await supabase
    .from('delivery_date_changes')
    .select('id', { count: 'exact', head: true })
    .gte('changed_at', lastWeek.toISOString());

  const newThisWeek = thisWeekCreated?.length || 0;
  const newLastWeek = lastWeekCreated?.length || 0;
  const deliveredThisWeek = thisWeekDelivered?.length || 0;
  const deliveredLastWeek = lastWeekDelivered?.length || 0;
  
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

  // Top pedidos
  const topOrders = activeOrders
    .filter((o: any) => (o as any).calculated_value > 0)
    .sort((a: any, b: any) => ((b as any).calculated_value || 0) - ((a as any).calculated_value || 0))
    .slice(0, 5)
    .map((o: any) => {
      const deliveryDate = o.delivery_date ? new Date(o.delivery_date) : null;
      const daysUntil = deliveryDate 
        ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const daysOverdue = (o as any).days_overdue || 0;

      return {
        orderNumber: o.order_number,
        customer: o.customer_name,
        totalValue: (o as any).calculated_value || 0,
        status: o.status,
        statusLabel: statusLabels[o.status] || o.status,
        daysUntilDelivery: daysUntil,
        daysOverdue: daysOverdue,
      };
    });

  // Detalhes por fase
  const phaseDetails = phaseOrder
    .filter(phaseKey => phaseKey !== 'conclusao')
    .map(phaseKey => ({
      phase: phaseLabels[phaseKey] || phaseKey,
      phaseKey,
      count: (byPhase as any)[phaseKey] || 0,
      orders: (phaseOrders[phaseKey] || []).slice(0, 3),
    }))
    .filter(phase => phase.count > 0);

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
    alerts: { 
      delayed: lateCount, 
      critical: criticalCount, 
      pendingLab, 
      pendingPurchase: pendingPurchase + awaitingMaterial 
    },
    phaseDetails,
    criticalPhaseAnalysis,
    extremelyOverdueOrders,
    portfolioHealth,
  };
}

// ==================== FORMATAÇÃO ====================
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getTrendArrow(change: number): string {
  if (change > 0) return `+${change}% ↑`;
  if (change < 0) return `${change}% ↓`;
  return '0%';
}

// Função auxiliar para converter para horário de São Paulo
function toSaoPauloTime(date: Date): Date {
  // São Paulo é UTC-3 (sem horário de verão desde 2019)
  const saoPauloOffset = -3 * 60; // -180 minutos
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utcTime + (saoPauloOffset * 60000));
}

function formatReportMessage(metrics: OrderMetrics, date: Date, scheduleTime?: string): string {
  // Converter para horário de São Paulo
  const spDate = toSaoPauloTime(date);
  
  const dateStr = spDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeLabel = scheduleTime || spDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let message = `📊 *RELATÓRIO GERENCIAL DIÁRIO*\n`;
  message += `📅 ${dateStr} • ${timeLabel} (Brasília)\n\n`;

  // RESUMO EXECUTIVO
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📈 *RESUMO EXECUTIVO*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `• Pedidos Ativos: *${metrics.totalActive}*\n`;
  message += `• Valor em Produção: *${formatCurrency(metrics.totalValue)}*\n`;
  message += `• Taxa de Cumprimento: *${metrics.sla.onTimeRate}%* ${metrics.sla.onTimeRate >= 85 ? '✅' : metrics.sla.onTimeRate >= 70 ? '⚠️' : '🔴'}\n`;
  message += `• Novos Hoje: *${metrics.newToday}*\n\n`;

  // ALERTAS CRÍTICOS
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
      message += `🛒 *${metrics.alerts.pendingPurchase}* aguardando Compras/Material\n`;
    }
    message += `\n`;
  }

  // PEDIDOS EXTREMAMENTE ATRASADOS
  if (metrics.extremelyOverdueOrders && metrics.extremelyOverdueOrders.length > 0) {
    message += `🆘 *PEDIDOS EXTREMAMENTE ATRASADOS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⚠️ *${metrics.extremelyOverdueOrders.length}* pedidos com mais de 30 dias de atraso:\n\n`;
    
    metrics.extremelyOverdueOrders.slice(0, 5).forEach((order, idx) => {
      message += `${idx + 1}. *#${order.orderNumber}* - ${order.daysOverdue}d atrasado\n`;
      message += `   ${formatCurrency(order.value)} | ${order.phaseLabel}\n`;
    });
    
    if (metrics.extremelyOverdueOrders.length > 5) {
      message += `\n_... e mais ${metrics.extremelyOverdueOrders.length - 5} pedidos_\n`;
    }
    message += `\n`;
  }

  // SAÚDE DO PORTFÓLIO
  if (metrics.portfolioHealth) {
    message += `🩺 *SAÚDE DO PORTFÓLIO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ Dentro do prazo: *${metrics.portfolioHealth.onTime.count}* (${metrics.portfolioHealth.onTime.percentage}%)\n`;
    message += `⚠️ 1-7 dias atrasados: *${metrics.portfolioHealth.late1to7.count}* (${metrics.portfolioHealth.late1to7.percentage}%)\n`;
    message += `🔴 8-30 dias atrasados: *${metrics.portfolioHealth.late8to30.count}* (${metrics.portfolioHealth.late8to30.percentage}%)\n`;
    message += `🆘 > 30 dias atrasados: *${metrics.portfolioHealth.lateOver30.count}* (${metrics.portfolioHealth.lateOver30.percentage}%)\n\n`;
  }

  // ANÁLISE DETALHADA - COMPRAS
  const comprasAnalysis = metrics.criticalPhaseAnalysis.compras;
  if (comprasAnalysis.count > 0) {
    message += `🛒 *ANÁLISE DETALHADA - COMPRAS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `• Total na fase: *${comprasAnalysis.count}* pedidos\n`;
    message += `• Tempo médio na fase: *${comprasAnalysis.avgDays}* dias\n`;
    message += `• Maior atraso: *${comprasAnalysis.maxDaysOverdue}* dias\n`;
    message += `• Valor parado: *${formatCurrency(comprasAnalysis.totalValue)}*\n`;
    
    if (comprasAnalysis.oldestOrders.length > 0) {
      message += `\n📌 *Pedidos mais atrasados:*\n`;
      comprasAnalysis.oldestOrders.forEach((order, idx) => {
        const criticalBadge = order.daysOverdue > 30 ? '🆘 ' : order.daysOverdue > 7 ? '⚠️ ' : '';
        message += `${idx + 1}. ${criticalBadge}#${order.orderNumber} - *${order.daysOverdue}d* atrasado (${formatCurrency(order.value)})\n`;
      });
    }
    
    if (comprasAnalysis.avgDays > phaseThresholds['compras']) {
      message += `\n⚠️ *GARGALO:* Tempo médio acima do limite (${phaseThresholds['compras']}d)\n`;
    }
    message += `\n`;
  }

  // ANÁLISE DETALHADA - PRODUÇÃO
  const prodClientesAnalysis = metrics.criticalPhaseAnalysis.producaoClientes;
  const prodEstoqueAnalysis = metrics.criticalPhaseAnalysis.producaoEstoque;
  const totalProducao = prodClientesAnalysis.count + prodEstoqueAnalysis.count;
  
  if (totalProducao > 0) {
    message += `🔧 *ANÁLISE DETALHADA - PRODUÇÃO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (prodClientesAnalysis.count > 0) {
      message += `\n👥 *Produção Clientes:*\n`;
      message += `• Pedidos: *${prodClientesAnalysis.count}*\n`;
      message += `• Tempo médio: *${prodClientesAnalysis.avgDays}* dias\n`;
      message += `• Valor: *${formatCurrency(prodClientesAnalysis.totalValue)}*\n`;
      
      if (prodClientesAnalysis.oldestOrders.length > 0) {
        message += `📌 Mais antigos: `;
        message += prodClientesAnalysis.oldestOrders.map(o => `#${o.orderNumber} (${o.daysInPhase}d)`).join(', ');
        message += `\n`;
      }
    }
    
    if (prodEstoqueAnalysis.count > 0) {
      message += `\n📦 *Produção Estoque:*\n`;
      message += `• Pedidos: *${prodEstoqueAnalysis.count}*\n`;
      message += `• Tempo médio: *${prodEstoqueAnalysis.avgDays}* dias\n`;
      message += `• Valor: *${formatCurrency(prodEstoqueAnalysis.totalValue)}*\n`;
      
      if (prodEstoqueAnalysis.oldestOrders.length > 0) {
        message += `📌 Mais antigos: `;
        message += prodEstoqueAnalysis.oldestOrders.map(o => `#${o.orderNumber} (${o.daysInPhase}d)`).join(', ');
        message += `\n`;
      }
    }
    
    const avgProducao = totalProducao > 0 
      ? ((prodClientesAnalysis.avgDays * prodClientesAnalysis.count) + (prodEstoqueAnalysis.avgDays * prodEstoqueAnalysis.count)) / totalProducao
      : 0;
    if (avgProducao > phaseThresholds['producaoClientes']) {
      message += `\n⚠️ *GARGALO:* Tempo médio de produção acima do limite (${phaseThresholds['producaoClientes']}d)\n`;
    }
    message += `\n`;
  }

  // TENDÊNCIAS SEMANAIS
  message += `📊 *TENDÊNCIAS (vs semana anterior)*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `• Novos: ${metrics.trends.newOrdersThisWeek} (${getTrendArrow(metrics.trends.newOrdersChange)})\n`;
  message += `• Entregues: ${metrics.trends.deliveredThisWeek} (${getTrendArrow(metrics.trends.deliveredChange)})\n`;
  message += `• Valor: ${formatCurrency(metrics.trends.valueThisWeek)} (${getTrendArrow(metrics.trends.valueChange)})\n`;
  message += `• Mudanças de prazo: ${metrics.trends.dateChanges7d}\n\n`;

  // DISTRIBUIÇÃO POR FASE
  message += `📦 *DISTRIBUIÇÃO POR FASE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  metrics.phaseDetails.forEach((phase) => {
    message += `• ${phase.phase}: *${phase.count}*\n`;
  });
  message += `\n`;

  // TOP 5 PEDIDOS
  if (metrics.topOrders.length > 0) {
    message += `💰 *TOP 5 PEDIDOS (MAIOR VALOR)*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    metrics.topOrders.forEach((order, idx) => {
      const daysIcon = order.daysOverdue > 0 ? '⚠️' : order.daysUntilDelivery <= 2 ? '🔴' : '✅';
      const daysText = order.daysOverdue > 0 
        ? `${order.daysOverdue}d atrasado` 
        : `${order.daysUntilDelivery}d`;

      message += `${idx + 1}. *${order.orderNumber}* - ${order.customer.substring(0, 30)}\n`;
      message += `   ${formatCurrency(order.totalValue)} | ${order.statusLabel} | ${daysIcon} ${daysText}\n\n`;
    });
  }

  // ESTATÍSTICAS DE PRODUÇÃO
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
  const spDateFooter = toSaoPauloTime(date);
  message += `🤖 _Relatório gerado às ${spDateFooter.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (Brasília)_\n`;
  message += `_Sistema de Gestão Imply_`;

  return message;
}

// ==================== FORMATAÇÃO - RESUMO RÁPIDO ====================
function formatSummaryReport(metrics: OrderMetrics, date: Date): string {
  const spDate = toSaoPauloTime(date);
  const dateStr = spDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = spDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let message = `📋 *RESUMO RÁPIDO* - ${dateStr} ${timeStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;

  message += `📦 Pedidos Ativos: *${metrics.totalActive}*\n`;
  message += `💰 Valor Total: *${formatCurrency(metrics.totalValue)}*\n`;
  message += `🎯 SLA: *${metrics.sla.onTimeRate}%* no prazo\n\n`;

  message += `📊 *Por Fase:*\n`;
  
  // Mostrar TODAS as fases com pedidos (exceto Conclusão)
  const activePhases = metrics.phaseDetails.filter(
    (phase) => phase.count > 0 && !phase.phase.includes('Conclusão')
  );
  
  activePhases.forEach((phase) => {
    message += `• ${phase.phase}: *${phase.count}*\n`;
  });
  
  // Se não houver nenhuma fase com pedidos
  if (activePhases.length === 0) {
    message += `• _Nenhum pedido ativo_\n`;
  }
  
  message += `\n`;

  if (metrics.alerts.delayed > 0 || metrics.alerts.critical > 0) {
    message += `⚠️ *Alertas:*\n`;
    if (metrics.alerts.delayed > 0) {
      message += `• ${metrics.alerts.delayed} pedidos atrasados\n`;
    }
    if (metrics.alerts.critical > 0) {
      message += `• ${metrics.alerts.critical} críticos (entrega hoje)\n`;
    }
  }

  message += `\n🤖 _Sistema de Gestão Imply_`;
  return message;
}

// ==================== FORMATAÇÃO - PEDIDOS URGENTES ====================
function formatUrgentReport(metrics: OrderMetrics, date: Date): string {
  const spDate = toSaoPauloTime(date);
  const dateStr = spDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let message = `🚨 *PEDIDOS URGENTES* - ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;

  // Pedidos críticos (entrega hoje/amanhã)
  const criticalOrders = metrics.topOrders.filter(o => o.daysUntilDelivery <= 1 && o.daysUntilDelivery >= 0);
  const nearDeadline = metrics.topOrders.filter(o => o.daysUntilDelivery > 1 && o.daysUntilDelivery <= 3);

  if (metrics.alerts.critical > 0) {
    message += `⚡ *ENTREGA HOJE/AMANHÃ (${metrics.alerts.critical}):*\n`;
    criticalOrders.slice(0, 5).forEach((order) => {
      message += `• *#${order.orderNumber}* - ${order.customer.substring(0, 25)}\n`;
      message += `  ${formatCurrency(order.totalValue)} | ${order.daysUntilDelivery === 0 ? 'HOJE' : 'Amanhã'}\n`;
    });
    message += `\n`;
  }

  if (nearDeadline.length > 0) {
    message += `📅 *PRÓXIMOS 2-3 DIAS (${nearDeadline.length}):*\n`;
    nearDeadline.slice(0, 5).forEach((order) => {
      message += `• *#${order.orderNumber}* - ${order.customer.substring(0, 25)} (${order.daysUntilDelivery}d)\n`;
    });
    message += `\n`;
  }

  // Extremamente atrasados
  if (metrics.extremelyOverdueOrders && metrics.extremelyOverdueOrders.length > 0) {
    message += `🔥 *CRÍTICOS (>7 dias atraso):*\n`;
    metrics.extremelyOverdueOrders.slice(0, 5).forEach((order) => {
      message += `• *#${order.orderNumber}* - ${order.daysOverdue} dias atrasado\n`;
    });
  }

  if (metrics.alerts.critical === 0 && (!metrics.extremelyOverdueOrders || metrics.extremelyOverdueOrders.length === 0)) {
    message += `✅ Nenhum pedido urgente no momento!\n`;
  }

  message += `\n🤖 _Sistema de Gestão Imply_`;
  return message;
}

// ==================== FORMATAÇÃO - PEDIDOS ATRASADOS ====================
function formatDelayedReport(metrics: OrderMetrics, date: Date): string {
  const spDate = toSaoPauloTime(date);
  const dateStr = spDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let message = `⏰ *PEDIDOS ATRASADOS* - ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;

  message += `Total: *${metrics.alerts.delayed}* pedidos (*${formatCurrency(metrics.sla.lateValue)}*)\n\n`;

  // Top 10 mais atrasados
  if (metrics.extremelyOverdueOrders && metrics.extremelyOverdueOrders.length > 0) {
    message += `📍 *TOP MAIS ATRASADOS:*\n`;
    metrics.extremelyOverdueOrders.slice(0, 10).forEach((order, idx) => {
      const icon = order.daysOverdue > 30 ? '🆘' : order.daysOverdue > 14 ? '⚠️' : '⏰';
      message += `${idx + 1}. ${icon} *#${order.orderNumber}* - ${order.daysOverdue}d\n`;
      message += `   ${formatCurrency(order.value)} | ${order.phaseLabel}\n`;
    });
    message += `\n`;
  }

  // Distribuição por fase
  message += `📊 *Por Fase:*\n`;
  const delayedByPhase: Record<string, number> = {};
  metrics.extremelyOverdueOrders?.forEach(o => {
    delayedByPhase[o.phaseLabel] = (delayedByPhase[o.phaseLabel] || 0) + 1;
  });
  Object.entries(delayedByPhase)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([phase, count]) => {
      message += `• ${phase}: ${count} atrasados\n`;
    });

  if (metrics.alerts.delayed === 0) {
    message += `✅ Nenhum pedido atrasado!\n`;
  }

  message += `\n🤖 _Sistema de Gestão Imply_`;
  return message;
}

// ==================== FORMATAÇÃO - RESUMO POR FASE ====================
function formatPhaseSummaryReport(metrics: OrderMetrics, date: Date): string {
  const spDate = toSaoPauloTime(date);
  const dateStr = spDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = spDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let message = `📦 *DISTRIBUIÇÃO POR FASE* - ${dateStr} ${timeStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;

  // Entrada
  const entrada = (metrics.byPhase.almoxSsm || 0) + (metrics.byPhase.gerarOrdem || 0);
  if (entrada > 0) {
    message += `📥 *Entrada:* ${entrada}\n`;
    if (metrics.byPhase.almoxSsm > 0) message += `  • Almox SSM: ${metrics.byPhase.almoxSsm}\n`;
    if (metrics.byPhase.gerarOrdem > 0) message += `  • Gerar Ordem: ${metrics.byPhase.gerarOrdem}\n`;
  }

  // Compras
  if (metrics.byPhase.compras > 0) {
    message += `\n🛒 *Compras:* ${metrics.byPhase.compras}\n`;
  }

  // Almox Geral
  if (metrics.byPhase.almoxGeral > 0) {
    message += `\n📦 *Almox Geral:* ${metrics.byPhase.almoxGeral}\n`;
  }

  // Produção
  const producao = (metrics.byPhase.producaoClientes || 0) + (metrics.byPhase.producaoEstoque || 0);
  if (producao > 0) {
    message += `\n🔧 *Produção:* ${producao}\n`;
    if (metrics.byPhase.producaoClientes > 0) message += `  • Clientes: ${metrics.byPhase.producaoClientes}\n`;
    if (metrics.byPhase.producaoEstoque > 0) message += `  • Estoque: ${metrics.byPhase.producaoEstoque}\n`;
  }

  // Gerar Saldo
  if (metrics.byPhase.gerarSaldo > 0) {
    message += `\n📊 *Gerar Saldo:* ${metrics.byPhase.gerarSaldo}\n`;
  }

  // Lab
  if (metrics.byPhase.laboratorio > 0) {
    message += `\n🔬 *Laboratório:* ${metrics.byPhase.laboratorio}\n`;
  }

  // Embalagem
  if (metrics.byPhase.embalagem > 0) {
    message += `\n📦 *Embalagem:* ${metrics.byPhase.embalagem}\n`;
  }

  // Cotação
  if (metrics.byPhase.cotacao > 0) {
    message += `\n💰 *Cotação Frete:* ${metrics.byPhase.cotacao}\n`;
  }

  // Faturamento
  const faturamento = (metrics.byPhase.aFaturar || 0) + (metrics.byPhase.faturamento || 0);
  if (faturamento > 0) {
    message += `\n🧾 *Faturamento:* ${faturamento}\n`;
    if (metrics.byPhase.aFaturar > 0) message += `  • À Faturar: ${metrics.byPhase.aFaturar}\n`;
    if (metrics.byPhase.faturamento > 0) message += `  • Em Faturamento: ${metrics.byPhase.faturamento}\n`;
  }

  // Expedição
  const expedicao = (metrics.byPhase.expedicao || 0) + (metrics.byPhase.emTransito || 0);
  if (expedicao > 0) {
    message += `\n🚛 *Expedição/Trânsito:* ${expedicao}\n`;
    if (metrics.byPhase.expedicao > 0) message += `  • Expedição: ${metrics.byPhase.expedicao}\n`;
    if (metrics.byPhase.emTransito > 0) message += `  • Em Trânsito: ${metrics.byPhase.emTransito}\n`;
  }

  message += `\n━━━━━━━━━━━━━━━━━━\n`;
  message += `Total: *${metrics.totalActive}* pedidos ativos\n`;
  message += `Valor: *${formatCurrency(metrics.totalValue)}*\n`;

  message += `\n🤖 _Sistema de Gestão Imply_`;
  return message;
}

// ==================== SELETOR DE FORMATO ====================
function formatReportByType(metrics: OrderMetrics, date: Date, reportType: string, scheduleTime?: string): string {
  switch (reportType) {
    case 'summary':
      return formatSummaryReport(metrics, date);
    case 'urgent':
      return formatUrgentReport(metrics, date);
    case 'delayed':
      return formatDelayedReport(metrics, date);
    case 'phase_summary':
      return formatPhaseSummaryReport(metrics, date);
    case 'full':
    default:
      return formatReportMessage(metrics, date, scheduleTime);
  }
}

// ==================== FORMATAÇÃO - RELATÓRIO POR FASE ====================
function formatPhaseSpecificReport(
  metrics: OrderMetrics, 
  phaseKey: string, 
  phaseName: string,
  date: Date
): string {
  // Converter para horário de São Paulo
  const spDate = toSaoPauloTime(date);
  
  const dateStr = spDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = spDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Encontrar dados da fase
  const phaseData = metrics.phaseDetails.find(p => p.phaseKey === phaseKey);
  const phaseCount = (metrics.byPhase as any)[phaseKey] || 0;

  let message = `📊 *RESUMO DA FASE: ${phaseName.toUpperCase()}*\n`;
  message += `─────────────────────\n`;
  message += `📅 ${dateStr} às ${timeStr} (Brasília)\n\n`;

  message += `📦 Pedidos na fase: *${phaseCount}*\n`;

  // Calcular atrasados na fase
  const phaseOrders = phaseData?.orders || [];
  const overdueInPhase = phaseOrders.filter((o: any) => o.daysOverdue > 0).length;

  if (overdueInPhase > 0) {
    message += `⚠️ Críticos (atraso): *${overdueInPhase}*\n`;
  }

  // Se é uma fase crítica, mostrar análise detalhada
  if (phaseKey === 'compras') {
    const analysis = metrics.criticalPhaseAnalysis.compras;
    message += `⏱️ Tempo médio: *${analysis.avgDays}* dias\n`;
    message += `💰 Valor parado: *${formatCurrency(analysis.totalValue)}*\n`;
    
    if (analysis.oldestOrders.length > 0) {
      message += `\n🔝 *Top 3 mais atrasados:*\n`;
      analysis.oldestOrders.forEach((order, idx) => {
        message += `${idx + 1}. #${order.orderNumber} - ${order.customer.substring(0, 20)} (${order.daysOverdue}d)\n`;
      });
    }
  } else if (phaseKey === 'producaoClientes') {
    const analysis = metrics.criticalPhaseAnalysis.producaoClientes;
    message += `⏱️ Tempo médio: *${analysis.avgDays}* dias\n`;
    message += `💰 Valor: *${formatCurrency(analysis.totalValue)}*\n`;
    
    if (analysis.oldestOrders.length > 0) {
      message += `\n🔝 *Top 3 mais antigos:*\n`;
      analysis.oldestOrders.forEach((order, idx) => {
        message += `${idx + 1}. #${order.orderNumber} - ${order.customer.substring(0, 20)} (${order.daysInPhase}d)\n`;
      });
    }
  } else if (phaseKey === 'producaoEstoque') {
    const analysis = metrics.criticalPhaseAnalysis.producaoEstoque;
    message += `⏱️ Tempo médio: *${analysis.avgDays}* dias\n`;
    message += `💰 Valor: *${formatCurrency(analysis.totalValue)}*\n`;
    
    if (analysis.oldestOrders.length > 0) {
      message += `\n🔝 *Top 3 mais antigos:*\n`;
      analysis.oldestOrders.forEach((order, idx) => {
        message += `${idx + 1}. #${order.orderNumber} - ${order.customer.substring(0, 20)} (${order.daysInPhase}d)\n`;
      });
    }
  } else if (phaseData && phaseData.orders.length > 0) {
    // Mostrar top 3 para outras fases
    message += `\n🔝 *Top 3 pedidos:*\n`;
    phaseData.orders.slice(0, 3).forEach((order: any, idx: number) => {
      const daysText = order.daysOverdue > 0 ? `${order.daysOverdue}d atrasado` : `${order.daysUntil}d`;
      message += `${idx + 1}. #${order.orderNumber} - ${order.customer.substring(0, 20)} (${daysText})\n`;
    });
  }

  // Resumo geral (breve)
  message += `\n─────────────────────\n`;
  message += `📈 *Visão Geral:*\n`;
  message += `• Total ativos: ${metrics.totalActive}\n`;
  message += `• SLA geral: ${metrics.sla.onTimeRate}%\n`;
  message += `• Atrasados: ${metrics.alerts.delayed}\n`;

  message += `\n_Acesse o sistema para detalhes._\n`;
  message += `🤖 _Sistema de Gestão Imply_`;

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
      .map(p => `${p.phase.replace(/[📥📋🛒📦🔧📊🔬💰💳🧾🚛🚚✅👥]/g, '').trim()}: ${p.count}`)
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

// Gerar imagem visual do Kanban (barras horizontais)
async function generateKanbanVisual(metrics: OrderMetrics): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not configured, skipping Kanban visual generation');
      return null;
    }

    // Preparar dados para o Kanban visual
    const kanbanData = metrics.phaseDetails
      .map(p => {
        const hasOverdue = (metrics.byPhase as any)[p.phaseKey] > 0;
        return `${p.phase.replace(/[📥📋🛒📦🔧📊🔬💰💳🧾🚛🚚✅👥]/g, '').trim()}: ${p.count} orders`;
      })
      .join('\n');
    
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const prompt = `Create a professional horizontal bar chart representing a Kanban board status:

Data:
${kanbanData}

Requirements:
- Horizontal bars representing each phase/column
- Bar length proportional to number of orders
- Use a color gradient: green for start phases, yellow for middle, red for end phases that need attention
- Title: "📊 Status do Kanban - ${date} ${time}"
- Show the count value at the end of each bar
- Dark theme with #1F2937 background
- White/light text labels
- Professional dashboard style
- Dimensions: 1000x600 pixels
- Add visual indicators: green checkmark for phases with low count, orange warning for medium, red alert for high count phases
- Clean, modern design suitable for WhatsApp sharing`;

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
      console.error('Kanban visual generation failed:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      return imageUrl.split(',')[1];
    }

    return null;
  } catch (error) {
    console.error('Error generating Kanban visual:', error);
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

// ==================== WHATSAPP ====================

// Check MEGA API connection status directly
// Returns connected: null when status is unknown (e.g., endpoint not supported)
async function checkMegaAPIConnectionStatus(instanceKey: string): Promise<{ 
  connected: boolean | null;  // null = unknown (don't block send)
  state: string; 
  reason?: string;
}> {
  try {
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';

    // Try multiple endpoints (different MEGA API versions have different routes)
    const endpoints = [
      `/rest/instance/connectionState/${instanceKey}`,
      `/instance/connectionState/${instanceKey}`,
      `/rest/fetchInstances`,
    ];

    for (const endpoint of endpoints) {
      const statusUrl = `${megaApiUrl}${endpoint}`;
      
      console.log('📡 Trying MEGA API status endpoint:', statusUrl);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'apikey': megaApiToken },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.status === 404) {
          console.log(`⚠️ Endpoint not found (404): ${endpoint}, trying next...`);
          continue; // Try next endpoint
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ MEGA API status check failed: ${response.status} - ${errorText.substring(0, 200)}`);
          continue; // Try next endpoint
        }

        const data = await response.json();
        console.log('📡 MEGA API connection state:', JSON.stringify(data));

        // Handle fetchInstances response (array of instances)
        if (Array.isArray(data)) {
          const instance = data.find((i: any) => i.id === instanceKey || i.instance === instanceKey);
          if (instance) {
            const state = instance.connectionStatus || instance.state || 'unknown';
            const isConnected = state === 'open' || state === 'connected';
            return { connected: isConnected, state, reason: !isConnected ? state : undefined };
          }
          console.warn('⚠️ Instance not found in fetchInstances response');
          continue;
        }

        // Handle direct connectionState response
        const state = data?.state || data?.status || data?.connectionStatus || 'unknown';
        const isConnected = state === 'open' || data?.connected === true || state === 'connected';
        
        return { 
          connected: isConnected, 
          state,
          reason: !isConnected ? (data?.message || state) : undefined
        };
      } catch (fetchError: unknown) {
        const errorName = fetchError instanceof Error ? fetchError.name : '';
        if (errorName === 'AbortError') {
          console.warn(`⚠️ Timeout on endpoint: ${endpoint}`);
        } else {
          console.warn(`⚠️ Error on endpoint ${endpoint}:`, fetchError);
        }
        continue; // Try next endpoint
      }
    }

    // All endpoints failed - return unknown status (don't block send)
    console.warn('⚠️ All status endpoints failed - status unknown, will attempt send anyway');
    return { connected: null, state: 'unknown_api_incompatible', reason: 'All status endpoints unavailable' };
    
  } catch (error) {
    console.error('❌ Error checking MEGA API status:', error);
    // On error, return unknown (don't block send)
    return { connected: null, state: 'check_error', reason: String(error) };
  }
}

// ==================== CONSTANTES DE ESTABILIDADE ====================
const DELAY_BETWEEN_SENDS_MS = 3000; // 3 segundos entre envios para evitar anti-spam
const MIN_CONNECTION_AGE_MS = 60000; // Aguardar 1 minuto após conexão para estabilizar

// Helper para delay
const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== VERIFICAR CONEXÃO ANTES DE ENVIAR ====================
async function verifyConnectionBeforeSend(supabaseClient: any): Promise<{ connected: boolean; instanceKey: string | null; shouldWait: boolean }> {
  try {
    const { data: instance } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key, status, connected_at, is_active')
      .eq('status', 'connected')
      .eq('is_active', true)
      .maybeSingle();

    if (!instance) {
      console.log('❌ Nenhuma instância WhatsApp conectada encontrada');
      return { connected: false, instanceKey: null, shouldWait: false };
    }

    // Verificar se a conexão é muito recente (pode estar instável)
    if (instance.connected_at) {
      const connectedAt = new Date(instance.connected_at);
      const timeSinceConnection = Date.now() - connectedAt.getTime();
      
      if (timeSinceConnection < MIN_CONNECTION_AGE_MS) {
        const waitTime = MIN_CONNECTION_AGE_MS - timeSinceConnection;
        console.log(`⏳ Conexão muito recente (${Math.round(timeSinceConnection/1000)}s). Aguardando ${Math.round(waitTime/1000)}s para estabilização...`);
        return { connected: true, instanceKey: instance.instance_key, shouldWait: true };
      }
    }

    console.log(`✅ Instância WhatsApp conectada e estável: ${instance.instance_key}`);
    return { connected: true, instanceKey: instance.instance_key, shouldWait: false };
  } catch (error) {
    console.error('Erro ao verificar conexão WhatsApp:', error);
    return { connected: false, instanceKey: null, shouldWait: false };
  }
}

async function sendWhatsAppMessage(supabaseClient: any, phone: string, message: string): Promise<boolean> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 3000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await attemptSendWhatsAppMessage(supabaseClient, phone, message, attempt);
    
    if (result.success) {
      return true;
    }
    
    // If not connected and we have retries left, wait and retry
    if (!result.wasConnected && attempt < MAX_RETRIES) {
      console.log(`⏳ Attempt ${attempt} failed due to disconnection, waiting ${RETRY_DELAY_MS}ms before retry...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    
    // Other error or last attempt
    if (attempt === MAX_RETRIES) {
      console.error(`❌ All ${MAX_RETRIES} attempts failed for WhatsApp send`);
    }
  }
  
  return false;
}

async function attemptSendWhatsAppMessage(
  supabaseClient: any, 
  phone: string, 
  message: string,
  attemptNumber: number
): Promise<{ success: boolean; wasConnected: boolean }> {
  try {
    // Log all instances for debugging
    const { data: allInstances } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key, status, is_active, connected_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(`📱 [Attempt ${attemptNumber}] WhatsApp instances status:`, JSON.stringify(allInstances || []));

    // Priority 1: Try to find a connected instance
    let { data: activeInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key, status, connected_at')
      .eq('status', 'connected')
      .maybeSingle();

    // Priority 2: Fallback to any active instance
    if (!activeInstance) {
      console.log('⚠️ No connected instance in DB, trying active fallback...');
      const { data: fallbackInstance } = await supabaseClient
        .from('whatsapp_instances')
        .select('instance_key, status, connected_at')
        .eq('is_active', true)
        .order('connected_at', { ascending: false, nullsFirst: false })
        .maybeSingle();
      
      if (fallbackInstance) {
        console.log(`⚠️ Using fallback instance: ${fallbackInstance.instance_key} (status: ${fallbackInstance.status})`);
        activeInstance = fallbackInstance;
      }
    }

    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance found (neither connected nor active)');
      return { success: false, wasConnected: false };
    }

    // === Check connection status directly with MEGA API ===
    const apiStatus = await checkMegaAPIConnectionStatus(activeInstance.instance_key);
    
    console.log(`🔍 [Attempt ${attemptNumber}] PRE-SEND DIAGNOSTIC:`, {
      timestamp: new Date().toISOString(),
      instanceKey: activeInstance.instance_key,
      dbStatus: activeInstance.status,
      apiStatus: apiStatus.state,
      apiConnected: apiStatus.connected,
      connectedAt: activeInstance.connected_at,
      recipient: phone,
      messageLength: message.length
    });

    // === CRITICAL FIX: Only block if EXPLICITLY disconnected ===
    // If apiStatus.connected is null (unknown), proceed with send attempt
    // If apiStatus.connected is false (explicitly disconnected), abort and update DB
    if (apiStatus.connected === false) {
      console.error(`❌ MEGA API reports EXPLICITLY disconnected: ${apiStatus.state} - ${apiStatus.reason}`);
      
      // Update DB to reflect real status (only for explicit disconnection)
      await supabaseClient
        .from('whatsapp_instances')
        .update({ 
          status: apiStatus.state === 'close' ? 'disconnected' : 'waiting_scan',
          updated_at: new Date().toISOString()
        })
        .eq('instance_key', activeInstance.instance_key);
      
      return { success: false, wasConnected: false };
    }
    
    // If status is unknown (null), log but proceed with send attempt
    if (apiStatus.connected === null) {
      console.log(`⚠️ MEGA API status unknown (${apiStatus.state}), proceeding with send attempt...`);
    }

    // === Check if connection is too recent (wait for stabilization) ===
    if (activeInstance.connected_at) {
      const connectedAt = new Date(activeInstance.connected_at);
      const now = new Date();
      const secondsSinceConnection = (now.getTime() - connectedAt.getTime()) / 1000;
      
      if (secondsSinceConnection < 10) {
        console.log(`⏳ Connection very recent (${secondsSinceConnection.toFixed(1)}s), waiting for stabilization...`);
        await new Promise(r => setTimeout(r, (10 - secondsSinceConnection) * 1000));
      }
    }

    // NOVO PADRÃO: 55 + DDD + 8 dígitos (SEM o 9)
    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }
    // Remover o 9 se presente (formato antigo)
    if (phoneNumber.length === 13 && phoneNumber.startsWith('55') && phoneNumber.charAt(4) === '9') {
      const ddd = phoneNumber.substring(2, 4);
      const numero = phoneNumber.substring(5);
      phoneNumber = '55' + ddd + numero;
    }

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';

    console.log(`📤 [Attempt ${attemptNumber}] Sending WhatsApp to ${phoneNumber} via instance ${activeInstance.instance_key}`);

    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/text`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    const body = {
      messageData: {
        to: phoneNumber,
        text: message,
        linkPreview: false,
      }
    };

    // Usar apenas o formato de autenticação que funciona (apikey) - evita requisições extras
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': megaApiToken,
    };

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    
    console.log(`📬 [Attempt ${attemptNumber}] MEGA API RESPONSE:`, {
      timestamp: new Date().toISOString(),
      status: response.status,
      body: responseText.substring(0, 300)
    });
    
    if (response.ok) {
      console.log('✅ WhatsApp message sent to:', phoneNumber);
      
      // Update instance status to connected if it wasn't
      if (activeInstance.status !== 'connected') {
        await supabaseClient
          .from('whatsapp_instances')
          .update({ status: 'connected', connected_at: new Date().toISOString() })
          .eq('instance_key', activeInstance.instance_key);
        console.log('✅ Instance status updated to connected');
      }
      
      return { success: true, wasConnected: true };
    }

    // Check if error indicates disconnection
    const lowerError = responseText.toLowerCase();
    if (lowerError.includes('disconnected') || lowerError.includes('not connected') || lowerError.includes('waiting_scan')) {
      console.error(`❌ MEGA API indicates disconnection during send: ${responseText}`);
      
      // Update DB status
      await supabaseClient
        .from('whatsapp_instances')
        .update({ status: 'waiting_scan', updated_at: new Date().toISOString() })
        .eq('instance_key', activeInstance.instance_key);
      
      return { success: false, wasConnected: false };
    }

    console.error(`❌ Mega API error: ${response.status} - ${responseText}`);
    return { success: false, wasConnected: true };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return { success: false, wasConnected: true };
  }
}

async function sendWhatsAppImage(supabaseClient: any, phone: string, base64Data: string, caption: string): Promise<boolean> {
  try {
    // Priority 1: Try connected instance
    let { data: activeInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_key, status')
      .eq('status', 'connected')
      .maybeSingle();

    // Priority 2: Fallback to active instance
    if (!activeInstance) {
      const { data: fallbackInstance } = await supabaseClient
        .from('whatsapp_instances')
        .select('instance_key, status')
        .eq('is_active', true)
        .maybeSingle();
      activeInstance = fallbackInstance;
    }

    if (!activeInstance) {
      console.error('❌ No active WhatsApp instance for image send');
      return false;
    }

    // NOVO PADRÃO: 55 + DDD + 8 dígitos (SEM o 9)
    let phoneNumber = phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }
    // Remover o 9 se presente (formato antigo)
    if (phoneNumber.length === 13 && phoneNumber.startsWith('55') && phoneNumber.charAt(4) === '9') {
      const ddd = phoneNumber.substring(2, 4);
      const numero = phoneNumber.substring(5);
      phoneNumber = '55' + ddd + numero;
    }

    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';

    const endpoint = `/rest/sendMessage/${activeInstance.instance_key}/image`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    const body = {
      messageData: {
        to: phoneNumber,
        image: `data:image/png;base64,${base64Data}`,
        caption: caption,
      }
    };

    // Usar apenas o formato de autenticação que funciona
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': megaApiToken,
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

    const errorText = await response.text();
    console.error(`❌ Mega API image error: ${response.status} - ${errorText}`);
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp image:', error);
    return false;
  }
}

// ==================== EMAIL ====================
async function sendEmailReport(
  email: string, 
  recipientName: string, 
  subject: string, 
  textContent: string, 
  kanbanImage?: string | null
): Promise<boolean> {
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not configured, skipping email');
      return false;
    }

    const resend = new Resend(RESEND_API_KEY);

    // Converter texto WhatsApp para HTML
    const htmlContent = textContent
      .replace(/\n/g, '<br>')
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/━/g, '─')
      .replace(/📊/g, '📊')
      .replace(/📅/g, '📅')
      .replace(/📈/g, '📈')
      .replace(/🚨/g, '🚨')
      .replace(/⚠️/g, '⚠️')
      .replace(/🔴/g, '🔴')
      .replace(/✅/g, '✅')
      .replace(/🆘/g, '🆘')
      .replace(/🩺/g, '🩺')
      .replace(/🛒/g, '🛒')
      .replace(/🔧/g, '🔧')
      .replace(/📦/g, '📦')
      .replace(/💰/g, '💰')
      .replace(/🤖/g, '🤖');

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #1F2937;
            color: #F3F4F6;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #374151;
            border-radius: 12px;
            padding: 24px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #4B5563;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .content {
            white-space: pre-wrap;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #4B5563;
            font-size: 12px;
            color: #9CA3AF;
          }
          img {
            max-width: 100%;
            border-radius: 8px;
            margin: 16px 0;
          }
          strong { color: #60A5FA; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #60A5FA;">📊 Relatório Gerencial</h1>
          </div>
          <div class="content">
            ${htmlContent}
          </div>
          ${kanbanImage ? `<img src="cid:kanban-visual" alt="Status do Kanban">` : ''}
          <div class="footer">
            <p>Sistema de Gestão Imply</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailOptions: any = {
      from: 'Relatórios IMPLY <onboarding@resend.dev>',
      to: [email],
      subject: subject,
      html: htmlEmail,
    };

    // Adicionar imagem como anexo inline se existir
    if (kanbanImage) {
      emailOptions.attachments = [{
        filename: 'kanban-status.png',
        content: kanbanImage,
        content_id: 'kanban-visual',
      }];
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('❌ Email send error:', error);
      return false;
    }

    console.log('✅ Email sent to:', email, data?.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

// ==================== BUSCAR GESTORES DE FASE ====================
async function getPhaseManagers(supabaseClient: any): Promise<PhaseManager[]> {
  try {
    const { data: managers, error } = await supabaseClient
      .from('phase_managers')
      .select(`
        user_id,
        phase_key,
        whatsapp,
        receive_daily_summary,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('is_active', true)
      .eq('receive_daily_summary', true);

    if (error) {
      console.error('Error fetching phase managers:', error);
      return [];
    }

    return (managers || []).map((m: any) => ({
      user_id: m.user_id,
      phase_key: m.phase_key,
      whatsapp: m.whatsapp,
      email: m.profiles?.email,
      full_name: m.profiles?.full_name || 'Gestor',
      receive_daily_summary: m.receive_daily_summary,
    }));
  } catch (error) {
    console.error('Error in getPhaseManagers:', error);
    return [];
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
    let includeKanbanVisual = true;
    let testMode = false;
    let testPhone = null;
    let testEmail = null;
    let sendEmail = true;
    let sendPhaseReports = true;
    let scheduleTime: string | undefined;
    let reportType = 'full'; // New: 'full', 'summary', 'urgent', 'delayed', 'phase_summary'

    try {
      const body = await req.json();
      includeChart = body.includeChart !== false;
      includeAllCharts = body.includeAllCharts === true;
      includeKanbanVisual = body.includeKanbanVisual !== false;
      testMode = body.testMode === true;
      testPhone = body.testPhone;
      testEmail = body.testEmail;
      sendEmail = body.sendEmail !== false;
      sendPhaseReports = body.sendPhaseReports !== false;
      scheduleTime = body.scheduleTime;
      reportType = body.reportType || 'full';
    } catch {
      // No body provided
    }

    console.log(`📊 Report type: ${reportType}`);

    // ========== BUSCAR DESTINATÁRIOS ==========
    let recipients: any[] = [];
    
    // Buscar números de teste da config do agente (suporta múltiplos)
    const { data: agentConfig } = await supabaseClient
      .from('ai_agent_config')
      .select('test_phones, test_phone')
      .limit(1)
      .maybeSingle();
    
    const configTestPhones = agentConfig?.test_phones || 
      (agentConfig?.test_phone ? [agentConfig.test_phone] : []);
    
    if (testMode) {
      // Em modo teste, usar números de teste passados no request OU da configuração
      const testPhonesToUse = testPhone ? [testPhone] : configTestPhones;
      
      if (testPhonesToUse.length > 0 || testEmail) {
        recipients = testPhonesToUse.map((phone: string) => ({
          whatsapp: phone,
          email: testEmail,
          id: null,
          full_name: 'Teste'
        }));
        
        // Se só tem email e nenhum telefone, adicionar
        if (testPhonesToUse.length === 0 && testEmail) {
          recipients = [{ whatsapp: null, email: testEmail, id: null, full_name: 'Teste' }];
        }
        
        console.log(`🧪 Test mode - sending to ${recipients.length} test recipient(s):`, 
          recipients.map(r => r.whatsapp || r.email));
      }
    } else {
      // Buscar da tabela management_report_recipients
      const { data: recipientsData, error: recipientsError } = await supabaseClient
        .from('management_report_recipients')
        .select('id, whatsapp, user_id, profiles:user_id(full_name, email)')
        .eq('is_active', true)
        .contains('report_types', ['daily']);

      if (!recipientsError && recipientsData && recipientsData.length > 0) {
        recipients = recipientsData.map((r: any) => ({
          id: r.id,
          whatsapp: r.whatsapp,
          email: r.profiles?.email,
          full_name: r.profiles?.full_name || 'Gestor',
        }));
      } else {
        // Fallback: buscar admins
        const { data: admins } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          const adminIds = admins.map((a: any) => a.user_id);
          const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, full_name, whatsapp, email')
            .in('id', adminIds);

          if (profiles) {
            recipients = profiles.map((p: any) => ({
              id: null,
              whatsapp: p.whatsapp,
              email: p.email,
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

    console.log(`📬 Found ${recipients.length} general recipients`);

    // ========== BUSCAR GESTORES DE FASE ==========
    let phaseManagers: PhaseManager[] = [];
    if (sendPhaseReports && !testMode) {
      phaseManagers = await getPhaseManagers(supabaseClient);
      console.log(`👥 Found ${phaseManagers.length} phase managers for specific reports`);
    }

    // ========== CALCULAR MÉTRICAS ==========
    const metrics = await calculateMetrics(supabaseClient);
    const reportDate = new Date();
    const message = formatReportByType(metrics, reportDate, reportType, scheduleTime);

    console.log('📊 Metrics calculated:', {
      totalActive: metrics.totalActive,
      totalValue: metrics.totalValue,
      onTimeRate: metrics.sla.onTimeRate,
      alerts: metrics.alerts,
    });

    // ========== GERAR GRÁFICOS ==========
    let distributionChart: string | null = null;
    let kanbanVisual: string | null = null;
    let trendChart: string | null = null;
    let slaGauge: string | null = null;

    if (includeChart) {
      console.log('🎨 Generating charts...');
      
      // Gerar gráfico de distribuição
      distributionChart = await generateDistributionChart(metrics);
      if (distributionChart) console.log('✅ Distribution chart generated');
      
      // Gerar visual do Kanban
      if (includeKanbanVisual) {
        kanbanVisual = await generateKanbanVisual(metrics);
        if (kanbanVisual) console.log('✅ Kanban visual generated');
      }
      
      // Gerar gráficos adicionais se solicitado
      if (includeAllCharts) {
        trendChart = await generateTrendChart(metrics);
        if (trendChart) console.log('✅ Trend chart generated');
        
        slaGauge = await generateSLAGauge(metrics);
        if (slaGauge) console.log('✅ SLA gauge generated');
      }
    }

    // ========== VERIFICAR CONEXÃO ANTES DE ENVIAR ==========
    const connectionCheck = await verifyConnectionBeforeSend(supabaseClient);
    
    if (!connectionCheck.connected) {
      console.error('❌ WhatsApp não conectado. Abortando envio de relatórios.');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não conectado. Escaneie o QR Code primeiro.',
          sentCount: 0 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se conexão recente, aguardar estabilização
    if (connectionCheck.shouldWait) {
      console.log('⏳ Aguardando 30 segundos para estabilização da conexão...');
      await delayMs(30000);
    }

    // ========== ENVIAR PARA DESTINATÁRIOS GERAIS ==========
    let sentCount = 0;
    let errorCount = 0;
    let emailSentCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Enviar via WhatsApp
        if (recipient.whatsapp) {
          const messageSent = await sendWhatsAppMessage(supabaseClient, recipient.whatsapp, message);
          
          let chartsSent = 0;
          if (messageSent) {
            // Pequeno delay entre mensagem e imagens
            await delayMs(1000);
            
            // Enviar visual do Kanban primeiro
            if (kanbanVisual) {
              const sent = await sendWhatsAppImage(
                supabaseClient,
                recipient.whatsapp,
                kanbanVisual,
                '📊 Status do Kanban'
              );
              if (sent) chartsSent++;
              await delayMs(1000);
            }

            if (distributionChart) {
              const sent = await sendWhatsAppImage(
                supabaseClient,
                recipient.whatsapp,
                distributionChart,
                '📊 Distribuição por Fase'
              );
              if (sent) chartsSent++;
              await delayMs(1000);
            }
            
            if (trendChart) {
              const sent = await sendWhatsAppImage(
                supabaseClient,
                recipient.whatsapp,
                trendChart,
                '📈 Tendência Semanal'
              );
              if (sent) chartsSent++;
              await delayMs(1000);
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

          // Log no banco
          await supabaseClient.from('management_report_log').insert({
            recipient_id: recipient.id,
            recipient_whatsapp: recipient.whatsapp,
            report_type: 'daily',
            status: messageSent ? 'sent' : 'failed',
            chart_sent: chartsSent > 0,
            message_content: message.substring(0, 500),
            metrics_snapshot: {
              totalActive: metrics.totalActive,
              totalValue: metrics.totalValue,
              onTimeRate: metrics.sla.onTimeRate,
              alerts: metrics.alerts,
              scheduleTime,
            },
          });

          if (messageSent) {
            sentCount++;
            console.log(`✅ WhatsApp sent to ${recipient.full_name} (${recipient.whatsapp})`);
          } else {
            errorCount++;
          }
        }

        // Enviar via Email
        if (sendEmail && recipient.email) {
          const dateStr = reportDate.toLocaleDateString('pt-BR');
          const subject = `📊 Relatório Gerencial Diário - ${dateStr}${scheduleTime ? ` (${scheduleTime})` : ''}`;
          
          const emailSent = await sendEmailReport(
            recipient.email,
            recipient.full_name,
            subject,
            message,
            kanbanVisual
          );

          if (emailSent) {
            emailSentCount++;
            console.log(`✅ Email sent to ${recipient.full_name} (${recipient.email})`);
          }
        }
        
        // DELAY ENTRE DESTINATÁRIOS para evitar anti-spam (exceto no último)
        if (i < recipients.length - 1 && recipient.whatsapp) {
          console.log(`⏳ Aguardando ${DELAY_BETWEEN_SENDS_MS}ms antes do próximo destinatário...`);
          await delayMs(DELAY_BETWEEN_SENDS_MS);
        }
        
      } catch (error) {
        console.error(`Error sending to ${recipient.full_name}:`, error);
        errorCount++;
      }
    }

    // ========== ENVIAR RELATÓRIOS ESPECÍFICOS POR FASE ==========
    let phaseReportsSent = 0;
    
    if (sendPhaseReports && phaseManagers.length > 0) {
      console.log('📤 Sending phase-specific reports...');
      
      // Delay inicial entre relatórios gerais e de fase
      await delayMs(2000);
      
      for (let j = 0; j < phaseManagers.length; j++) {
        const manager = phaseManagers[j];
        try {
          // Converter phase_key do banco para chave interna
          const internalPhaseKey = phaseKeyDbToInternal[manager.phase_key] || manager.phase_key;
          const phaseName = phaseLabels[internalPhaseKey] || manager.phase_key;
          
          // Gerar relatório específico da fase
          const phaseReport = formatPhaseSpecificReport(
            metrics,
            internalPhaseKey,
            phaseName,
            reportDate
          );

          // Enviar via WhatsApp
          if (manager.whatsapp) {
            const sent = await sendWhatsAppMessage(supabaseClient, manager.whatsapp, phaseReport);
            if (sent) {
              phaseReportsSent++;
              console.log(`✅ Phase report sent to ${manager.full_name} (${phaseName})`);
            }
            
            // Delay entre envios de fase
            if (j < phaseManagers.length - 1) {
              await delayMs(DELAY_BETWEEN_SENDS_MS);
            }
          }

          // Enviar via Email
          if (sendEmail && manager.email) {
            const dateStr = reportDate.toLocaleDateString('pt-BR');
            const subject = `📊 Resumo ${phaseName} - ${dateStr}`;
            
            await sendEmailReport(
              manager.email,
              manager.full_name,
              subject,
              phaseReport,
              null
            );
          }
        } catch (error) {
          console.error(`Error sending phase report to ${manager.full_name}:`, error);
        }
      }
    }

    console.log(`📊 Report summary: ${sentCount} WhatsApp, ${emailSentCount} emails, ${phaseReportsSent} phase reports, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        emailSentCount,
        phaseReportsSent,
        errorCount,
        metrics: {
          totalActive: metrics.totalActive,
          onTimeRate: metrics.sla.onTimeRate,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in daily management report:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
