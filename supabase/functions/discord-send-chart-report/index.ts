import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLORS = { success: 0x22c55e, warning: 0xeab308, error: 0xef4444, info: 0x3b82f6, purple: 0x8b5cf6, discord: 0x5865f2 };

// Mapeamento completo de status para labels amigáveis com emojis
const statusToPhase: Record<string, string> = {
  // Preparação/Planejamento
  pending: "📥 Pendente",
  almox_ssm_pending: "📥 Almox SSM",
  in_analysis: "🔍 Em Análise",
  awaiting_approval: "⏳ Aguardando Aprovação",
  planned: "📋 Planejado",
  
  // Gerar Ordem
  order_generation_pending: "📋 Pendente Ordem",
  order_in_creation: "📋 Criando Ordem",
  order_generated: "📋 Ordem Gerada",
  
  // Almox Geral
  almox_general_separating: "📦 Separando",
  almox_general_ready: "📦 Pronto Almox",
  
  // Compras
  purchase_pending: "🛒 Compras",
  purchase_quoted: "🛒 Cotação Recebida",
  purchase_ordered: "🛒 Pedido Emitido",
  purchase_received: "📦 Material Recebido",
  awaiting_parts: "🛒 Compras",
  waiting_purchase: "🛒 Compras",
  purchase_required: "🛒 Solicitar Compra",
  purchase_requested: "🛒 Solicitado Compra",
  
  // Separação/Produção
  separation_started: "🔧 Separação",
  in_production: "🔧 Produção",
  production_client: "🔧 Produção",
  production_stock: "📦 Prod. Estoque",
  awaiting_material: "⏳ Aguardando Material",
  separation_completed: "✅ Separação Concluída",
  production_completed: "✅ Produção Concluída",
  awaiting_production: "⏳ Aguardando Produção",
  
  // Laboratório
  awaiting_lab: "🔬 Laboratório",
  in_lab_analysis: "🔬 Laboratório",
  lab_completed: "✅ Lab Concluído",
  
  // Embalagem/Conferência
  in_quality_check: "📦 Conferência",
  in_packaging: "📦 Embalagem",
  packaging: "📦 Embalagem",
  ready_for_shipping: "📦 Pronto Envio",
  
  // Cotação de Frete
  freight_quote: "💰 Cotação",
  freight_quote_requested: "💰 Cotação Frete",
  freight_quote_received: "💰 Cotação Recebida",
  freight_approved: "💰 Frete Aprovado",
  
  // Expedição/Logística
  logistics: "🚛 Expedição",
  released_for_shipping: "🚛 Liberado Envio",
  in_expedition: "🚛 Expedição",
  in_transit: "🚚 Em Trânsito",
  pickup_scheduled: "🚚 Retirada Agendada",
  awaiting_pickup: "🚚 Aguardando Retirada",
  collected: "🚚 Coletado",
  
  // À Faturar (Nova Fase)
  ready_to_invoice: "💳 À Faturar",
  pending_invoice_request: "💳 Aguardando Solicitação",
  awaiting_invoicing: "💳 À Faturar",
  
  // Faturamento
  invoicing: "🧾 Faturamento",
  invoice_requested: "🧾 Faturamento",
  awaiting_invoice: "🧾 Processando NF",
  invoice_issued: "🧾 NF Emitida",
  invoice_sent: "🧾 NF Enviada",
  
  // Conclusão
  delivered: "✅ Entregue",
  completed: "✅ Concluído",
  
  // Exceções
  cancelled: "❌ Cancelado",
  on_hold: "⏸️ Em Espera",
  delayed: "⚠️ Atrasado",
  returned: "↩️ Devolvido",
  
  // Itens/Estoque
  in_stock: "📦 Em Estoque",
  almox_ssm_received: "📦 Recebido SSM",
  almox_general_received: "📦 Recebido Almox",
  
  // Saldo
  balance_calculation: "🧮 Calculando Saldo",
  balance_review: "🧮 Revisando Saldo",
  balance_approved: "🧮 Saldo Aprovado",
};

const getSlaEmoji = (r: number) => r >= 85 ? "🟢" : r >= 70 ? "🟡" : "🔴";
const getSlaColor = (r: number) => r >= 85 ? COLORS.success : r >= 70 ? COLORS.warning : COLORS.error;
const formatCurrency = (v: number) => v > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "Valor N/D";
const pct = (p: number, t: number) => t === 0 ? 0 : Math.round((p / t) * 100);
const getStatusLabel = (s: string) => statusToPhase[s] || s;

function getBrazilDateTime() {
  const now = new Date();
  return {
    dateStr: now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Sao_Paulo" }),
    timeStr: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
  };
}

// Calcula valor total de um pedido a partir dos itens
function calculateOrderValue(order: any): number {
  if (!order.order_items || order.order_items.length === 0) return 0;
  return order.order_items.reduce((sum: number, item: any) => {
    const price = Number(item.unit_price) || 0;
    const qty = Number(item.requested_quantity) || 0;
    return sum + (price * qty);
  }, 0);
}

async function calculateMetrics(supabase: any) {
  // Query com JOIN em order_items para calcular valores
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        unit_price,
        requested_quantity
      )
    `)
    .not("status", "in", "(completed,delivered,cancelled)");

  if (error) {
    console.error("[discord-send-chart-report] Error fetching orders:", error);
  }

  // Processar orders e calcular valores
  const activeOrders = (orders || []).map((o: any) => ({
    ...o,
    total_value: calculateOrderValue(o)
  }));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let onTime = 0, late = 0, lateValue = 0, critical = 0;
  const phaseCount: Record<string, { count: number; value: number }> = {};

  activeOrders.forEach((o: any) => {
    const phase = getStatusLabel(o.status);
    phaseCount[phase] = phaseCount[phase] || { count: 0, value: 0 };
    phaseCount[phase].count++;
    phaseCount[phase].value += o.total_value || 0;

    if (o.delivery_date) {
      const diff = Math.ceil((new Date(o.delivery_date).getTime() - now.getTime()) / 86400000);
      if (diff < 0) { late++; lateValue += o.total_value || 0; } else onTime++;
      if (diff >= 0 && diff <= 2) critical++;
    }
  });

  return {
    totalActive: activeOrders.length,
    totalValue: activeOrders.reduce((s: number, o: any) => s + (o.total_value || 0), 0),
    newToday: activeOrders.filter((o: any) => new Date(o.created_at) >= todayStart).length,
    sla: { onTimeRate: activeOrders.length > 0 ? Math.round((onTime / activeOrders.length) * 100) : 100, lateCount: late, lateValue },
    alerts: { critical, delayed: late, pendingLab: activeOrders.filter((o: any) => ["awaiting_lab", "in_lab_analysis"].includes(o.status)).length, pendingPurchase: activeOrders.filter((o: any) => ["awaiting_parts", "waiting_purchase", "purchase_pending", "purchase_required", "purchase_requested"].includes(o.status)).length },
    phaseDetails: Object.entries(phaseCount).map(([phase, d]) => ({ phase, ...d })).sort((a, b) => b.count - a.count),
    orders: activeOrders,
  };
}

async function calculateExtended(supabase: any, orders: any[]) {
  const now = new Date();
  let onTime = 0, d1to7 = 0, d8to30 = 0, dOver30 = 0;
  const extremely: any[] = [];

  orders.forEach((o: any) => {
    if (o.delivery_date) {
      const diff = Math.ceil((now.getTime() - new Date(o.delivery_date).getTime()) / 86400000);
      if (diff <= 0) onTime++;
      else if (diff <= 7) d1to7++;
      else if (diff <= 30) d8to30++;
      else { dOver30++; extremely.push({ order_number: o.order_number, daysLate: diff, value: o.total_value || 0, statusLabel: getStatusLabel(o.status) }); }
    }
  });
  extremely.sort((a, b) => b.daysLate - a.daysLate);

  const topOrders = [...orders].sort((a, b) => (b.total_value || 0) - (a.total_value || 0)).slice(0, 5).map((o: any) => ({
    order_number: o.order_number, customer_name: o.customer_name || "N/A", value: o.total_value || 0,
    statusLabel: getStatusLabel(o.status), daysLate: o.delivery_date ? Math.max(0, Math.ceil((now.getTime() - new Date(o.delivery_date).getTime()) / 86400000)) : 0,
  }));

  const purchaseOrders = orders.filter((o: any) => ["awaiting_parts", "waiting_purchase", "purchase_pending", "purchase_required", "purchase_requested", "purchase_quoted", "purchase_ordered"].includes(o.status));
  const prodClient = orders.filter((o: any) => ["in_production", "production_client", "separation_started", "awaiting_material"].includes(o.status));
  const prodStock = orders.filter((o: any) => o.status === "production_stock");

  const calcAvg = (arr: any[]) => arr.length === 0 ? 0 : Math.round(arr.map((o: any) => Math.ceil((now.getTime() - new Date(o.created_at).getTime()) / 86400000)).reduce((s, d) => s + d, 0) / arr.length * 10) / 10;

  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const { data: recent } = await supabase.from("orders").select("id, status").gte("created_at", weekAgo.toISOString());
  const { data: dateChanges } = await supabase.from("order_date_changes").select("id").gte("changed_at", weekAgo.toISOString());

  const allProd = [...prodClient, ...prodStock];
  const prodDays = allProd.map((o: any) => Math.ceil((now.getTime() - new Date(o.created_at).getTime()) / 86400000));

  return {
    health: { onTime, d1to7, d8to30, dOver30 },
    extremely: extremely.slice(0, 20),
    topOrders,
    purchase: { count: purchaseOrders.length, avgDays: calcAvg(purchaseOrders), value: purchaseOrders.reduce((s: number, o: any) => s + (o.total_value || 0), 0) },
    prodClient: { count: prodClient.length, avgDays: calcAvg(prodClient), value: prodClient.reduce((s: number, o: any) => s + (o.total_value || 0), 0) },
    prodStock: { count: prodStock.length, avgDays: calcAvg(prodStock), value: prodStock.reduce((s: number, o: any) => s + (o.total_value || 0), 0) },
    trends: { newOrders: recent?.length || 0, delivered: recent?.filter((o: any) => o.status === "delivered").length || 0, dateChanges: dateChanges?.length || 0 },
    avgProdDays: prodDays.length > 0 ? Math.round(prodDays.reduce((s, d) => s + d, 0) / prodDays.length) : 0,
    minProdDays: prodDays.length > 0 ? Math.min(...prodDays) : 0,
    maxProdDays: prodDays.length > 0 ? Math.max(...prodDays) : 0,
    endingToday: orders.filter((o: any) => o.delivery_date && new Date(o.delivery_date).toDateString() === now.toDateString()).length,
  };
}

const genPhaseChart = (phases: any[]) => `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({ type: "doughnut", data: { labels: phases.slice(0, 8).map(p => p.phase.replace(/[🔧🛒🚚📦🔬💰🧾💳📥✅❌🚛⚠️⏸️↩️⏳📋🔍🧮]/g, "").trim()), datasets: [{ data: phases.slice(0, 8).map(p => p.count), backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"] }] }, options: { plugins: { legend: { position: "right" }, title: { display: true, text: "Distribuição por Fase" } } } }))}&w=500&h=300&bkg=white`;
const genHealthChart = (h: any) => `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({ type: "doughnut", data: { labels: ["No Prazo", "1-7d", "8-30d", ">30d"], datasets: [{ data: [h.onTime, h.d1to7, h.d8to30, h.dOver30], backgroundColor: ["#22c55e", "#eab308", "#f97316", "#ef4444"] }] }, options: { plugins: { legend: { position: "right" }, title: { display: true, text: "Saúde do Portfólio" } } } }))}&w=500&h=300&bkg=white`;
const genSlaGauge = (r: number) => `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({ type: "radialGauge", data: { datasets: [{ data: [r], backgroundColor: r >= 85 ? "#22c55e" : r >= 70 ? "#eab308" : "#ef4444" }] }, options: { domain: [0, 100], trackColor: "#e5e7eb" } }))}&w=200&h=200&bkg=white`;

function buildEmbeds(m: any, e: any) {
  const { dateStr, timeStr } = getBrazilDateTime();
  const total = e.health.onTime + e.health.d1to7 + e.health.d8to30 + e.health.dOver30;
  const embeds: any[] = [];

  embeds.push({ title: "📊 RELATÓRIO GERENCIAL DIÁRIO", description: `📅 ${dateStr} • ${timeStr} (Brasília)`, color: getSlaColor(m.sla.onTimeRate), fields: [
    { name: "📦 Pedidos Ativos", value: String(m.totalActive), inline: true }, { name: "💰 Valor", value: formatCurrency(m.totalValue), inline: true },
    { name: "📈 SLA", value: `${m.sla.onTimeRate}% ${getSlaEmoji(m.sla.onTimeRate)}`, inline: true }, { name: "🆕 Novos Hoje", value: String(m.newToday), inline: true },
  ], thumbnail: { url: genSlaGauge(m.sla.onTimeRate) } });

  if (m.alerts.delayed > 0) embeds.push({ title: "🚨 ALERTAS CRÍTICOS", color: COLORS.error, fields: [
    { name: "⚠️ Atrasados", value: `**${m.alerts.delayed}** (${formatCurrency(m.sla.lateValue)})`, inline: false },
    { name: "🔴 Críticos (<48h)", value: String(m.alerts.critical), inline: true }, { name: "🔬 Lab", value: String(m.alerts.pendingLab), inline: true }, { name: "🛒 Compras", value: String(m.alerts.pendingPurchase), inline: true },
  ] });

  if (e.extremely.length > 0) embeds.push({ title: `🆘 EXTREMAMENTE ATRASADOS (${e.health.dOver30} >30d)`, color: COLORS.error, description: e.extremely.slice(0, 10).map((o: any, i: number) => `**${i + 1}.** #${o.order_number} - **${o.daysLate}d** | ${formatCurrency(o.value)} | ${o.statusLabel}`).join("\n") });

  embeds.push({ title: "🩺 SAÚDE DO PORTFÓLIO", color: COLORS.discord, fields: [
    { name: "✅ No Prazo", value: `${e.health.onTime} (${pct(e.health.onTime, total)}%)`, inline: true }, { name: "⚠️ 1-7d", value: `${e.health.d1to7} (${pct(e.health.d1to7, total)}%)`, inline: true },
    { name: "🔴 8-30d", value: `${e.health.d8to30} (${pct(e.health.d8to30, total)}%)`, inline: true }, { name: "🆘 >30d", value: `${e.health.dOver30} (${pct(e.health.dOver30, total)}%)`, inline: true },
  ], image: { url: genHealthChart(e.health) } });

  embeds.push({ title: "🛒 COMPRAS + 🔧 PRODUÇÃO", color: COLORS.purple, fields: [
    { name: "🛒 Compras", value: `${e.purchase.count} | ${e.purchase.avgDays}d | ${formatCurrency(e.purchase.value)}`, inline: false },
    { name: "👥 Prod. Clientes", value: `${e.prodClient.count} | ${e.prodClient.avgDays}d | ${formatCurrency(e.prodClient.value)}`, inline: false },
    { name: "📦 Prod. Estoque", value: `${e.prodStock.count} | ${e.prodStock.avgDays}d | ${formatCurrency(e.prodStock.value)}`, inline: false },
  ] });

  embeds.push({ title: "📦 DISTRIBUIÇÃO POR FASE", color: COLORS.info, description: m.phaseDetails.slice(0, 10).map((p: any) => `• ${p.phase}: **${p.count}** (${formatCurrency(p.value)})`).join("\n"), image: { url: genPhaseChart(m.phaseDetails) } });

  embeds.push({ title: "💰 TOP 5 PEDIDOS", color: COLORS.warning, description: e.topOrders.map((o: any, i: number) => `**${i + 1}.** #${o.order_number} - ${o.customer_name.substring(0, 25)}\n    ${formatCurrency(o.value)} | ${o.statusLabel}${o.daysLate > 0 ? ` | ⚠️ ${o.daysLate}d` : ""}`).join("\n") });

  embeds.push({ title: "📊 TENDÊNCIAS + PRODUÇÃO", color: COLORS.purple, fields: [
    { name: "🆕 Novos (7d)", value: String(e.trends.newOrders), inline: true }, { name: "✅ Entregues (7d)", value: String(e.trends.delivered), inline: true }, { name: "📅 Mudanças", value: String(e.trends.dateChanges), inline: true },
    { name: "⏱️ Média Prod.", value: `${e.avgProdDays}d`, inline: true }, { name: "📉 Mín/Máx", value: `${e.minProdDays}/${e.maxProdDays}d`, inline: true }, { name: "🎯 Vencem Hoje", value: String(e.endingToday), inline: true },
  ], footer: { text: `🤖 Sistema de Gestão • ${timeStr} (Brasília)` }, timestamp: new Date().toISOString() });

  return embeds;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { organizationId } = await req.json().catch(() => ({}));

    console.log(`[discord-send-chart-report] Starting. Org: ${organizationId || "all"}`);

    let q = supabase.from("discord_webhooks").select("*").eq("is_active", true).eq("receive_visual_reports", true);
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data: webhooks } = await q;

    if (!webhooks?.length) return new Response(JSON.stringify({ success: true, sent: 0, message: "No webhooks" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const metrics = await calculateMetrics(supabase);
    const extended = await calculateExtended(supabase, metrics.orders);
    const embeds = buildEmbeds(metrics, extended);

    console.log(`[discord-send-chart-report] Metrics: ${metrics.totalActive} orders, value: ${metrics.totalValue}`);

    let sent = 0;
    for (const wh of webhooks) {
      try {
        const res = await fetch(wh.webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds }) });
        if (res.ok) sent++;
        else console.error(`Failed ${wh.channel_name}:`, await res.text());
      } catch (e) { console.error(`Error webhook ${wh.id}:`, e); }
    }

    console.log(`[discord-send-chart-report] Complete. Sent: ${sent}/${webhooks.length}`);
    return new Response(JSON.stringify({ success: true, sent, total: webhooks.length, embedCount: embeds.length, metrics: { totalActive: metrics.totalActive, totalValue: metrics.totalValue, slaRate: metrics.sla.onTimeRate } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[discord-send-chart-report] Error:", errMsg);
    return new Response(JSON.stringify({ success: false, error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
