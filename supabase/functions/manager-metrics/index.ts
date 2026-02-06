import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManagerMetrics {
  // SLA
  onTimeRate: number;
  activeOrders: number;
  onTimeCount: number;
  criticalCount: number;
  overdueCount: number;
  overdueValue: number;
  totalValue: number;
  
  // Por Fase
  phaseMetrics: Array<{
    phase: string;
    count: number;
    avgDays: number;
    threshold: number;
    isBottleneck: boolean;
  }>;
  
  // Tendência
  weeklyTrend: {
    newOrdersThisWeek: number;
    newOrdersLastWeek: number;
    newOrdersChange: number;
    deliveredThisWeek: number;
    deliveredLastWeek: number;
    deliveredChange: number;
    valueThisWeek: number;
    valueLastWeek: number;
    valueChange: number;
  };
  
  // Alertas
  criticalAlerts: Array<{
    type: string;
    count: number;
    severity: 'critical' | 'warning' | 'info';
    details: string;
  }>;
  
  // Top Pedidos
  topOrders: Array<{
    orderNumber: string;
    customerName: string;
    value: number;
    deliveryDate: string;
    status: string;
    daysUntilDelivery: number;
  }>;
  
  // Atualizado em
  calculatedAt: string;
}

// Validar API Key para chamadas externas
function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  const expectedKey = Deno.env.get('N8N_API_KEY');
  return !!expectedKey && apiKey === expectedKey;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    if (!validateApiKey(req)) {
      console.error('manager-metrics: Unauthorized request - invalid or missing API key');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized - valid x-api-key header required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 Calculating manager metrics...');

    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Buscar pedidos ativos
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, status, total_value, delivery_date, created_at, updated_at')
      .not('status', 'in', '("completed","cancelled","delivered")');

    const orders = activeOrders || [];
    
    // ==================== CÁLCULOS DE SLA ====================
    let onTimeCount = 0;
    let criticalCount = 0;
    let overdueCount = 0;
    let overdueValue = 0;
    const totalValue = orders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);

    orders.forEach(order => {
      if (!order.delivery_date) return;
      const deliveryDate = new Date(order.delivery_date);
      const daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        overdueCount++;
        overdueValue += Number(order.total_value) || 0;
      } else if (daysUntil <= 2) {
        criticalCount++;
      } else {
        onTimeCount++;
      }
    });

    const onTimeRate = orders.length > 0 
      ? Math.round((onTimeCount / orders.length) * 100) 
      : 100;

    // ==================== MÉTRICAS POR FASE ====================
    const phaseConfig: Record<string, { statuses: string[]; threshold: number }> = {
      'Produção': { statuses: ['in_production', 'separation_started', 'awaiting_material', 'production_completed'], threshold: 7 },
      'Laboratório': { statuses: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'], threshold: 3 },
      'Embalagem': { statuses: ['in_packaging', 'ready_for_shipping', 'in_quality_check'], threshold: 2 },
      'Faturamento': { statuses: ['invoice_requested', 'awaiting_invoice', 'invoice_issued'], threshold: 2 },
      'Expedição': { statuses: ['released_for_shipping', 'in_expedition', 'awaiting_pickup'], threshold: 2 },
      'Cotação': { statuses: ['freight_quote_requested', 'freight_quote_received'], threshold: 3 },
      'Transporte': { statuses: ['in_transit', 'collected'], threshold: 5 },
    };

    const phaseMetrics: ManagerMetrics['phaseMetrics'] = [];

    for (const [phase, config] of Object.entries(phaseConfig)) {
      const phaseOrders = orders.filter(o => config.statuses.includes(o.status));
      
      if (phaseOrders.length === 0) continue;

      let totalDays = 0;
      phaseOrders.forEach(o => {
        const updatedAt = new Date(o.updated_at || o.created_at);
        const daysInPhase = Math.ceil((today.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += daysInPhase;
      });

      const avgDays = totalDays / phaseOrders.length;

      phaseMetrics.push({
        phase,
        count: phaseOrders.length,
        avgDays: Math.round(avgDays * 10) / 10,
        threshold: config.threshold,
        isBottleneck: avgDays > config.threshold,
      });
    }

    // Ordenar por quantidade
    phaseMetrics.sort((a, b) => b.count - a.count);

    // ==================== TENDÊNCIA SEMANAL ====================
    const { data: thisWeekCreated } = await supabase
      .from('orders')
      .select('id, total_value')
      .gte('created_at', lastWeek.toISOString());

    const { data: lastWeekCreated } = await supabase
      .from('orders')
      .select('id, total_value')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', lastWeek.toISOString());

    const { data: thisWeekDelivered } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'delivered')
      .gte('updated_at', lastWeek.toISOString());

    const { data: lastWeekDelivered } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'delivered')
      .gte('updated_at', twoWeeksAgo.toISOString())
      .lt('updated_at', lastWeek.toISOString());

    const newThisWeek = thisWeekCreated?.length || 0;
    const newLastWeek = lastWeekCreated?.length || 0;
    const deliveredThisWeek = thisWeekDelivered?.length || 0;
    const deliveredLastWeek = lastWeekDelivered?.length || 0;
    const valueThisWeek = (thisWeekCreated || []).reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);
    const valueLastWeek = (lastWeekCreated || []).reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);

    const weeklyTrend: ManagerMetrics['weeklyTrend'] = {
      newOrdersThisWeek: newThisWeek,
      newOrdersLastWeek: newLastWeek,
      newOrdersChange: newLastWeek > 0 ? Math.round(((newThisWeek - newLastWeek) / newLastWeek) * 100) : 0,
      deliveredThisWeek,
      deliveredLastWeek,
      deliveredChange: deliveredLastWeek > 0 ? Math.round(((deliveredThisWeek - deliveredLastWeek) / deliveredLastWeek) * 100) : 0,
      valueThisWeek,
      valueLastWeek,
      valueChange: valueLastWeek > 0 ? Math.round(((valueThisWeek - valueLastWeek) / valueLastWeek) * 100) : 0,
    };

    // ==================== ALERTAS CRÍTICOS ====================
    const criticalAlerts: ManagerMetrics['criticalAlerts'] = [];

    if (overdueCount > 0) {
      criticalAlerts.push({
        type: 'delayed_orders',
        count: overdueCount,
        severity: 'critical',
        details: `${overdueCount} pedidos atrasados (R$ ${overdueValue.toLocaleString('pt-BR')})`,
      });
    }

    if (criticalCount >= 5) {
      criticalAlerts.push({
        type: 'critical_sla',
        count: criticalCount,
        severity: 'warning',
        details: `${criticalCount} pedidos vencem em até 48h`,
      });
    }

    // Verificar gargalos
    phaseMetrics.filter(p => p.isBottleneck).forEach(p => {
      criticalAlerts.push({
        type: 'bottleneck',
        count: p.count,
        severity: 'warning',
        details: `${p.phase}: ${p.count} pedidos (média ${p.avgDays} dias, limite ${p.threshold})`,
      });
    });

    // Tendência negativa
    if (weeklyTrend.deliveredChange <= -20) {
      criticalAlerts.push({
        type: 'negative_trend',
        count: Math.abs(weeklyTrend.deliveredChange),
        severity: 'info',
        details: `Entregas caíram ${Math.abs(weeklyTrend.deliveredChange)}% vs semana anterior`,
      });
    }

    // ==================== TOP PEDIDOS ====================
    const topOrders: ManagerMetrics['topOrders'] = orders
      .filter(o => o.total_value)
      .sort((a, b) => Number(b.total_value) - Number(a.total_value))
      .slice(0, 10)
      .map(o => {
        const deliveryDate = o.delivery_date ? new Date(o.delivery_date) : null;
        const daysUntil = deliveryDate 
          ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        return {
          orderNumber: o.order_number,
          customerName: o.customer_name,
          value: Number(o.total_value),
          deliveryDate: o.delivery_date || '',
          status: o.status,
          daysUntilDelivery: daysUntil,
        };
      });

    // ==================== RESULTADO FINAL ====================
    const metrics: ManagerMetrics = {
      onTimeRate,
      activeOrders: orders.length,
      onTimeCount,
      criticalCount,
      overdueCount,
      overdueValue,
      totalValue,
      phaseMetrics,
      weeklyTrend,
      criticalAlerts,
      topOrders,
      calculatedAt: new Date().toISOString(),
    };

    console.log('✅ Metrics calculated:', {
      activeOrders: orders.length,
      onTimeRate,
      alerts: criticalAlerts.length,
    });

    return new Response(
      JSON.stringify({ success: true, metrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error calculating metrics:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
