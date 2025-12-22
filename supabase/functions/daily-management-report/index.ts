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
  
  // Distribuição por Fase (TODAS as 15 fases do Kanban)
  byPhase: {
    almoxSsm: number;
    gerarOrdem: number;
    compras: number;
    almoxGeral: number;
    producaoClientes: number;  // SEPARADO
    producaoEstoque: number;   // SEPARADO
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

  // NOVO: Análise detalhada de fases críticas
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

  // NOVO: Pedidos extremamente atrasados (>30 dias)
  extremelyOverdueOrders: Array<{
    orderNumber: string;
    customer: string;
    daysOverdue: number;
    value: number;
    phase: string;
    phaseLabel: string;
  }>;

  // NOVO: Saúde do Portfólio
  portfolioHealth: {
    onTime: { count: number; percentage: number };
    late1to7: { count: number; percentage: number };
    late8to30: { count: number; percentage: number };
    lateOver30: { count: number; percentage: number };
  };
}

// ==================== MAPEAMENTOS ====================
// Status para fase base (produção será resolvida dinamicamente baseado em order_category)
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
  // Produção (será mapeado dinamicamente)
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

// Função para determinar fase real (separando produção por categoria)
function getPhaseFromOrder(status: string, orderCategory: string): string {
  const basePhase = statusToPhaseBase[status] || 'conclusao';
  
  // Se é produção, separar por categoria do pedido
  if (basePhase === 'producao') {
    // 'vendas' = clientes, outros = estoque
    return orderCategory === 'vendas' ? 'producaoClientes' : 'producaoEstoque';
  }
  
  return basePhase;
}

const phaseLabels: Record<string, string> = {
  'almoxSsm': '📥 Almox SSM',
  'gerarOrdem': '📋 Gerar Ordem',
  'compras': '🛒 Compras',
  'almoxGeral': '📦 Almox Geral',
  'producaoClientes': '🔧 Produção Clientes',  // NOVO
  'producaoEstoque': '📦 Produção Estoque',     // NOVO
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

// Ordem de exibição das fases (como no Kanban)
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
  'compras': 10,          // Compras tem threshold maior
  'almoxGeral': 2,
  'producaoClientes': 7,  // NOVO
  'producaoEstoque': 7,   // NOVO
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

  // Buscar pedidos ativos COM order_items e order_category para calcular valor e fase
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

  // Buscar histórico de status para calcular dias na fase corretamente
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
      
      // Criar mapa de última entrada na fase por pedido
      activeOrders.forEach((order: any) => {
        const history = historyData?.filter((h: any) => h.order_id === order.id && h.new_status === order.status);
        if (history && history.length > 0) {
          lastStatusChangeMap[order.id] = new Date(history[0].changed_at);
        } else {
          // Fallback para created_at se não houver histórico
          lastStatusChangeMap[order.id] = new Date(order.created_at);
        }
      });
    }
  }

  // Inicializar contadores por fase (TODAS as fases)
  const byPhase: OrderMetrics['byPhase'] = {
    almoxSsm: 0, 
    gerarOrdem: 0, 
    compras: 0, 
    almoxGeral: 0,
    producaoClientes: 0,  // NOVO
    producaoEstoque: 0,   // NOVO
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
  
  // Para análise crítica de Compras e Produção
  const criticalPhaseOrders: Record<string, any[]> = {
    compras: [],
    producaoClientes: [],
    producaoEstoque: [],
  };
  
  // NOVO: Para pedidos extremamente atrasados e saúde do portfólio
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
    
    // Usar função para determinar fase real
    const phaseKey = getPhaseFromOrder(status, orderCategory);
    
    // Contar por fase
    if (phaseKey in byPhase) {
      (byPhase as any)[phaseKey]++;
    }
    
    // Agrupar pedidos por fase
    if (!phaseOrders[phaseKey]) phaseOrders[phaseKey] = [];
    if (!phaseDays[phaseKey]) phaseDays[phaseKey] = [];
    if (!phaseValues[phaseKey]) phaseValues[phaseKey] = 0;
    
    // Calcular dias na fase usando histórico de mudança de status (mais preciso)
    const phaseStartedAt = lastStatusChangeMap[order.id] || new Date(order.created_at);
    const daysInPhase = Math.ceil((today.getTime() - phaseStartedAt.getTime()) / (1000 * 60 * 60 * 24));
    phaseDays[phaseKey].push(daysInPhase);

    // Calcular dias até entrega e dias de atraso
    let daysUntilDelivery = 999;
    let daysOverdue = 0;
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      daysOverdue = daysUntilDelivery < 0 ? Math.abs(daysUntilDelivery) : 0;
    }

    // Calcular valor somando dos itens
    const orderValue = (order.order_items || []).reduce((sum: number, item: any) => {
      const itemValue = item.total_value || (item.unit_price * item.requested_quantity) || 0;
      return sum + Number(itemValue);
    }, 0);
    totalValue += orderValue;
    phaseValues[phaseKey] = (phaseValues[phaseKey] || 0) + orderValue;
    
    // Guardar valor calculado no objeto order para uso posterior
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

    // Coletar dados para análise de fases críticas (com daysOverdue)
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

    // NOVO: Coletar todos os pedidos para análise de extremamente atrasados
    allOrdersWithOverdue.push({
      orderNumber: order.order_number,
      customer: order.customer_name,
      daysOverdue: daysOverdue,
      value: orderValue,
      phase: phaseKey,
      phaseLabel: phaseLabels[phaseKey] || phaseKey,
    });

    // NOVO: Calcular saúde do portfólio
    if (daysOverdue === 0) {
      healthOnTime++;
    } else if (daysOverdue >= 1 && daysOverdue <= 7) {
      healthLate1to7++;
    } else if (daysOverdue >= 8 && daysOverdue <= 30) {
      healthLate8to30++;
    } else if (daysOverdue > 30) {
      healthLateOver30++;
    }

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
    if (status.startsWith('purchase_')) {
      pendingPurchase++;
    }
    if (status === 'awaiting_material') {
      awaitingMaterial++;
    }

    // Calcular tempo de produção (ambas as fases)
    if (phaseKey === 'producaoClientes' || phaseKey === 'producaoEstoque') {
      productionDays.push(daysInPhase);
    }
  });

  // NOVO: Filtrar e ordenar pedidos extremamente atrasados (>30 dias)
  const extremelyOverdueOrders = allOrdersWithOverdue
    .filter(o => o.daysOverdue > 30)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10);

  // NOVO: Calcular percentuais de saúde do portfólio
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

  // Calcular análise de fases críticas (Compras ordenado por daysOverdue, outros por daysInPhase)
  const calculateCriticalPhaseStats = (phaseKey: string, sortByOverdue: boolean = false) => {
    const orders = criticalPhaseOrders[phaseKey] || [];
    const days = phaseDays[phaseKey] || [];
    const value = phaseValues[phaseKey] || 0;
    
    // Para Compras: ordenar por dias de atraso (mais atrasados primeiro)
    // Para Produção: ordenar por dias na fase (mais antigos primeiro)
    const sortedOrders = sortByOverdue 
      ? [...orders].sort((a, b) => b.daysOverdue - a.daysOverdue)
      : [...orders].sort((a, b) => b.daysInPhase - a.daysInPhase);
    
    // Calcular max daysOverdue
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
    compras: calculateCriticalPhaseStats('compras', true), // Ordenar por atraso
    producaoClientes: calculateCriticalPhaseStats('producaoClientes', false),
    producaoEstoque: calculateCriticalPhaseStats('producaoEstoque', false),
  };

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

  // ==================== TOP PEDIDOS (com daysOverdue) ====================
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

  // ==================== DETALHES POR FASE (TODAS as fases, na ordem do Kanban) ====================
  const phaseDetails = phaseOrder
    .filter(phaseKey => phaseKey !== 'conclusao') // Excluir conclusão dos ativos
    .map(phaseKey => ({
      phase: phaseLabels[phaseKey] || phaseKey,
      phaseKey,
      count: (byPhase as any)[phaseKey] || 0,
      orders: (phaseOrders[phaseKey] || []).slice(0, 3),
    }))
    .filter(phase => phase.count > 0); // Só mostrar fases com pedidos

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
      message += `🛒 *${metrics.alerts.pendingPurchase}* aguardando Compras/Material\n`;
    }
    message += `\n`;
  }

  // ========== NOVO: PEDIDOS EXTREMAMENTE ATRASADOS (>30 dias) ==========
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

  // ========== NOVO: SAÚDE DO PORTFÓLIO ==========
  if (metrics.portfolioHealth) {
    message += `🩺 *SAÚDE DO PORTFÓLIO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ Dentro do prazo: *${metrics.portfolioHealth.onTime.count}* (${metrics.portfolioHealth.onTime.percentage}%)\n`;
    message += `⚠️ 1-7 dias atrasados: *${metrics.portfolioHealth.late1to7.count}* (${metrics.portfolioHealth.late1to7.percentage}%)\n`;
    message += `🔴 8-30 dias atrasados: *${metrics.portfolioHealth.late8to30.count}* (${metrics.portfolioHealth.late8to30.percentage}%)\n`;
    message += `🆘 > 30 dias atrasados: *${metrics.portfolioHealth.lateOver30.count}* (${metrics.portfolioHealth.lateOver30.percentage}%)\n\n`;
  }

  // ========== ANÁLISE DETALHADA - COMPRAS (ORDENADO POR ATRASO) ==========
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
    
    // Alerta de gargalo em Compras
    if (comprasAnalysis.avgDays > phaseThresholds['compras']) {
      message += `\n⚠️ *GARGALO:* Tempo médio acima do limite (${phaseThresholds['compras']}d)\n`;
    }
    message += `\n`;
  }

  // ========== ANÁLISE DETALHADA - PRODUÇÃO (NOVA SEÇÃO) ==========
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
    
    // Alerta de gargalo em Produção
    const avgProducao = totalProducao > 0 
      ? ((prodClientesAnalysis.avgDays * prodClientesAnalysis.count) + (prodEstoqueAnalysis.avgDays * prodEstoqueAnalysis.count)) / totalProducao
      : 0;
    if (avgProducao > phaseThresholds['producaoClientes']) {
      message += `\n⚠️ *GARGALO:* Tempo médio de produção acima do limite (${phaseThresholds['producaoClientes']}d)\n`;
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

  // ========== DISTRIBUIÇÃO POR FASE (TODAS AS FASES COM PEDIDOS) ==========
  message += `📦 *DISTRIBUIÇÃO POR FASE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  // Ordenar por quantidade e mostrar todas que têm pedidos
  const sortedPhases = [...metrics.phaseDetails].sort((a, b) => b.count - a.count);
  sortedPhases.forEach(phase => {
    message += `• ${phase.phase}: *${phase.count}*\n`;
  });
  message += `\n`;

  // ========== GARGALOS ==========
  if (metrics.bottlenecks.length > 0) {
    message += `🎯 *GARGALOS IDENTIFICADOS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.bottlenecks.slice(0, 5).forEach(b => {
      message += `⚠️ ${b.phase}: ${b.avgDays}d média (limite: ${b.threshold}d) - ${b.count} pedidos\n`;
    });
    message += `\n`;
  }

  // ========== TOP 5 PEDIDOS (COM INDICADORES DE ATRASO EXTREMO) ==========
  if (metrics.topOrders.length > 0) {
    message += `💰 *TOP 5 PEDIDOS (MAIOR VALOR)*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.topOrders.forEach((order, idx) => {
      // Indicadores visuais baseados no atraso
      let daysIcon = '🕐';
      let daysText = '';
      
      if (order.daysOverdue > 30) {
        daysIcon = '🆘';
        daysText = `${order.daysOverdue}d atrasado`;
      } else if (order.daysOverdue > 0) {
        daysIcon = '⚠️';
        daysText = `${order.daysOverdue}d atrasado`;
      } else if (order.daysUntilDelivery <= 2) {
        daysIcon = '🔴';
        daysText = order.daysUntilDelivery === 0 ? 'Hoje' : `${order.daysUntilDelivery}d`;
      } else {
        daysText = `${order.daysUntilDelivery}d`;
      }
      
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
      criticalPhases: {
        compras: metrics.criticalPhaseAnalysis.compras.count,
        producaoClientes: metrics.criticalPhaseAnalysis.producaoClientes.count,
        producaoEstoque: metrics.criticalPhaseAnalysis.producaoEstoque.count,
      },
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
          criticalPhases: metrics.criticalPhaseAnalysis,
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
