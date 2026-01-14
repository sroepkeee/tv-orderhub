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

// ==================== CÁLCULOS ====================
async function calculateMetrics(supabase: any): Promise<OrderMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, created_at, order_items(total_value, unit_price, requested_quantity)')
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

// ==================== FORMATAÇÃO ====================
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

// Relatório COMPLETO com todas as métricas
function formatFullReport(metrics: OrderMetrics & { topOrders?: any[]; weeklyTrend?: any }): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `📊 *RELATÓRIO GERENCIAL COMPLETO*\n`;
  msg += `📅 ${dateStr} • ${timeStr}\n\n`;
  
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 *RESUMO EXECUTIVO*\n`;
  msg += `• Pedidos Ativos: *${metrics.totalActive}*\n`;
  msg += `• Valor Total: *${formatCurrency(metrics.totalValue)}*\n`;
  msg += `• SLA: *${metrics.sla.onTimeRate}%* ${metrics.sla.onTimeRate >= 85 ? '✅' : metrics.sla.onTimeRate >= 70 ? '⚠️' : '🔴'}\n`;
  msg += `• Novos Hoje: *${metrics.newToday}*\n\n`;
  
  // Alertas e Gargalos
  msg += `🚨 *ALERTAS*\n`;
  msg += `• Atrasados: *${metrics.alerts.delayed}* (${formatCurrency(metrics.sla.lateValue)})\n`;
  msg += `• Críticos (1-2 dias): *${metrics.alerts.critical}*\n`;
  if (metrics.alerts.pendingLab > 0) msg += `• Pendentes Lab: *${metrics.alerts.pendingLab}*\n`;
  if (metrics.alerts.pendingPurchase > 0) msg += `• Aguardando Compras: *${metrics.alerts.pendingPurchase}*\n`;
  msg += `\n`;
  
  // SLA Detalhado
  msg += `📊 *SLA DETALHADO*\n`;
  msg += `• No prazo: *${metrics.sla.onTimeCount}* pedidos\n`;
  msg += `• Atrasados: *${metrics.sla.lateCount}* pedidos\n`;
  msg += `• Taxa: *${metrics.sla.onTimeRate}%*\n\n`;
  
  // Distribuição por Fase
  msg += `📦 *DISTRIBUIÇÃO POR FASE*\n`;
  metrics.phaseDetails.forEach(p => {
    const bar = '█'.repeat(Math.min(10, Math.ceil(p.count / Math.max(...metrics.phaseDetails.map(x => x.count)) * 10)));
    msg += `• ${p.phase}: *${p.count}* ${bar}\n`;
  });
  msg += `\n`;
  
  // Top 5 Pedidos (se disponível)
  if (metrics.topOrders && metrics.topOrders.length > 0) {
    msg += `💰 *TOP 5 PEDIDOS POR VALOR*\n`;
    metrics.topOrders.slice(0, 5).forEach((order, idx) => {
      msg += `${idx + 1}. ${order.order_number} - ${formatCurrency(order.value)}\n`;
    });
    msg += `\n`;
  }
  
  msg += `🤖 _Sistema Imply - Relatório Completo_`;
  return msg;
}

// Relatório RESUMO (rápido)
function formatSummaryReport(metrics: OrderMetrics): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `📋 *RESUMO RÁPIDO*\n`;
  msg += `📅 ${dateStr} • ${timeStr}\n\n`;
  
  msg += `📦 Ativos: *${metrics.totalActive}*\n`;
  msg += `💰 Valor: *${formatCurrency(metrics.totalValue)}*\n`;
  msg += `📊 SLA: *${metrics.sla.onTimeRate}%* ${metrics.sla.onTimeRate >= 85 ? '✅' : '⚠️'}\n\n`;
  
  msg += `📊 *POR FASE*\n`;
  metrics.phaseDetails.slice(0, 6).forEach(p => {
    msg += `• ${p.phase}: *${p.count}*\n`;
  });
  
  msg += `\n🤖 _Sistema Imply_`;
  return msg;
}

// Relatório URGENTES (entrega em 1-2 dias)
function formatUrgentReport(metrics: OrderMetrics & { urgentOrders?: any[] }): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `🚨 *PEDIDOS URGENTES*\n`;
  msg += `📅 ${dateStr} • ${timeStr}\n\n`;
  
  msg += `⚡ *${metrics.alerts.critical}* pedidos com entrega em 1-2 dias!\n\n`;
  
  if (metrics.urgentOrders && metrics.urgentOrders.length > 0) {
    msg += `📋 *LISTA*\n`;
    metrics.urgentOrders.slice(0, 10).forEach(order => {
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
function formatDelayedReport(metrics: OrderMetrics & { delayedOrders?: any[] }): string {
  const { dateStr, timeStr } = getBrazilDateTime();
  
  let msg = `⏰ *PEDIDOS ATRASADOS*\n`;
  msg += `📅 ${dateStr} • ${timeStr}\n\n`;
  
  msg += `⚠️ *${metrics.alerts.delayed}* pedidos atrasados\n`;
  msg += `💰 Valor em risco: *${formatCurrency(metrics.sla.lateValue)}*\n\n`;
  
  if (metrics.delayedOrders && metrics.delayedOrders.length > 0) {
    msg += `📋 *TOP ATRASADOS*\n`;
    metrics.delayedOrders.slice(0, 10).forEach(order => {
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
  msg += `📅 ${dateStr} • ${timeStr}\n\n`;
  
  msg += `📦 Total: *${metrics.totalActive}* pedidos ativos\n\n`;
  
  metrics.phaseDetails.forEach(p => {
    const pct = Math.round((p.count / metrics.totalActive) * 100);
    const bar = '█'.repeat(Math.ceil(pct / 10));
    msg += `${p.phase}\n  *${p.count}* (${pct}%) ${bar}\n\n`;
  });
  
  msg += `🤖 _Sistema Imply_`;
  return msg;
}

// Função principal que seleciona o formato correto
function formatReport(
  metrics: OrderMetrics & { topOrders?: any[]; urgentOrders?: any[]; delayedOrders?: any[]; weeklyTrend?: any }, 
  reportType: string
): string {
  switch (reportType) {
    case 'full':
      return formatFullReport(metrics);
    case 'summary':
      return formatSummaryReport(metrics);
    case 'urgent':
      return formatUrgentReport(metrics);
    case 'delayed':
      return formatDelayedReport(metrics);
    case 'phase_summary':
      return formatPhaseReport(metrics);
    default:
      return formatFullReport(metrics);
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

// Helper: Verificar se token é placeholder
function isPlaceholderToken(token: string | null | undefined): boolean {
  if (!token || token.trim() === '') return true;
  const placeholders = ['SEU_TOKEN', 'API_KEY', 'YOUR_TOKEN', 'TOKEN_AQUI', 'PLACEHOLDER'];
  return placeholders.some(p => token.toUpperCase().includes(p));
}

// Helper: Gerar variantes de telefone (sem 9 e com 9)
function getPhoneVariants(phone: string): string[] {
  let canonical = phone.replace(/\D/g, '');
  if (!canonical.startsWith('55')) canonical = `55${canonical}`;
  
  // Normalizar para 12 dígitos (sem 9)
  if (canonical.length === 13 && canonical[4] === '9') {
    canonical = canonical.slice(0, 4) + canonical.slice(5);
  }
  
  const without9 = canonical; // 55DDXXXXXXXX (12 dígitos)
  const with9 = canonical.slice(0, 4) + '9' + canonical.slice(4); // 55DD9XXXXXXXX (13 dígitos)
  
  // Preferir sem 9 primeiro (padrão WhatsApp oficial)
  return [without9, with9];
}

/**
 * Tenta enviar com múltiplos formatos de header de autenticação
 */
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

/**
 * Obtém o melhor token disponível (banco ou env), ignorando placeholders
 */
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

    // Obter token efetivo (banco ou env, ignorando placeholders)
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

    // Tentar cada variante de telefone
    for (let i = 0; i < phoneVariants.length; i++) {
      const phoneNumber = phoneVariants[i];
      const isLastVariant = i === phoneVariants.length - 1;
      
      console.log(`📲 Trying ${phoneNumber}...`);
      
      const body = { messageData: { to: phoneNumber, text: message, linkPreview: false } };
      
      // Tentar com múltiplos headers
      const res = await tryMultiHeaderFetch(url, token, body);

      if (res?.ok) {
        console.log('✅ WhatsApp sent to:', phoneNumber);
        return true;
      }

      if (res) {
        const err = await res.text();
        console.warn(`⚠️ Failed for ${phoneNumber}: ${res.status} - ${err.substring(0, 100)}`);
        
        // Se erro 400/404 (número inválido), tentar próxima variante
        if ((res.status === 400 || res.status === 404) && !isLastVariant) {
          await delayMs(500);
          continue;
        }
        
        // Erro de auth já tentou todos os headers
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

// ==================== MÉTRICAS ADICIONAIS ====================
async function calculateExtendedMetrics(supabase: any): Promise<{
  topOrders: any[];
  urgentOrders: any[];
  delayedOrders: any[];
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, delivery_date, created_at, order_items(total_value, unit_price, requested_quantity)')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  
  // Calcular valor de cada pedido
  const ordersWithValue = activeOrders.map((order: any) => {
    const value = (order.order_items || []).reduce((sum: number, item: any) => {
      return sum + Number(item.total_value || (item.unit_price * item.requested_quantity) || 0);
    }, 0);
    
    let daysUntil = null;
    let daysLate = null;
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      daysUntil = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) daysLate = Math.abs(daysUntil);
    }
    
    return { ...order, value, daysUntil, daysLate };
  });
  
  // Top 10 por valor
  const topOrders = [...ordersWithValue]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  
  // Urgentes (entrega em 0-2 dias)
  const urgentOrders = ordersWithValue
    .filter((o: any) => o.daysUntil !== null && o.daysUntil >= 0 && o.daysUntil <= 2)
    .sort((a: any, b: any) => a.daysUntil - b.daysUntil);
  
  // Atrasados (ordenados por mais dias de atraso)
  const delayedOrders = ordersWithValue
    .filter((o: any) => o.daysLate !== null && o.daysLate > 0)
    .sort((a: any, b: any) => b.daysLate - a.daysLate);
  
  return { topOrders, urgentOrders, delayedOrders };
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
    let includeChart = true;
    let includeAllCharts = false;
    
    try {
      const body = await req.json();
      testMode = body.testMode === true;
      testPhone = body.testPhone;
      testEmail = body.testEmail;
      sendEmailFlag = body.sendEmail !== false;
      reportType = body.reportType || 'full';
      includeChart = body.includeChart !== false;
      includeAllCharts = body.includeAllCharts === true;
    } catch { /* No body */ }

    console.log(`📋 Report type: ${reportType}, includeChart: ${includeChart}, includeAllCharts: ${includeAllCharts}`);

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

    // Calcular métricas
    const metrics = await calculateMetrics(supabase);
    
    // Calcular métricas estendidas para relatórios específicos
    let extendedMetrics: { topOrders: any[]; urgentOrders: any[]; delayedOrders: any[] } = { 
      topOrders: [], 
      urgentOrders: [], 
      delayedOrders: [] 
    };
    if (['full', 'urgent', 'delayed'].includes(reportType)) {
      extendedMetrics = await calculateExtendedMetrics(supabase);
    }
    
    const fullMetrics = { ...metrics, ...extendedMetrics };
    const message = formatReport(fullMetrics, reportType);

    console.log('📊 Metrics:', { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate, reportType });

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
          metrics_snapshot: { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate, reportType },
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
        metrics: { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
