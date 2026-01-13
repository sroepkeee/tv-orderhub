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

function formatReport(metrics: OrderMetrics, date: Date): string {
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let msg = `📊 *RELATÓRIO GERENCIAL*\n📅 ${dateStr} • ${timeStr}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n📈 *RESUMO*\n`;
  msg += `• Pedidos Ativos: *${metrics.totalActive}*\n`;
  msg += `• Valor Total: *${formatCurrency(metrics.totalValue)}*\n`;
  msg += `• SLA: *${metrics.sla.onTimeRate}%* ${metrics.sla.onTimeRate >= 85 ? '✅' : '⚠️'}\n`;
  msg += `• Novos Hoje: *${metrics.newToday}*\n\n`;

  if (metrics.alerts.delayed > 0 || metrics.alerts.critical > 0) {
    msg += `🚨 *ALERTAS*\n`;
    if (metrics.alerts.delayed > 0) msg += `⚠️ *${metrics.alerts.delayed}* atrasados (${formatCurrency(metrics.sla.lateValue)})\n`;
    if (metrics.alerts.critical > 0) msg += `🔴 *${metrics.alerts.critical}* críticos\n`;
    msg += `\n`;
  }

  msg += `📦 *POR FASE*\n`;
  metrics.phaseDetails.slice(0, 10).forEach(p => {
    msg += `• ${p.phase}: *${p.count}*\n`;
  });

  msg += `\n🤖 _Sistema Imply_`;
  return msg;
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

async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<boolean> {
  try {
    const instance = await getActiveInstance(supabase);
    if (!instance) {
      console.error('❌ No WhatsApp instance');
      return false;
    }

    // Obter token com fallback robusto
    let token = instance.api_token;
    if (isPlaceholderToken(token)) {
      console.warn('⚠️ Token do banco é placeholder, usando MEGA_API_TOKEN do environment');
      token = Deno.env.get('MEGA_API_TOKEN') || '';
    }
    
    if (!token || token.trim() === '') {
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
    for (const phoneNumber of phoneVariants) {
      console.log(`📲 Trying ${phoneNumber}...`);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': token },
        body: JSON.stringify({ messageData: { to: phoneNumber, text: message, linkPreview: false } }),
      });

      if (res.ok) {
        console.log('✅ WhatsApp sent to:', phoneNumber);
        return true;
      }

      const err = await res.text();
      console.warn(`⚠️ Failed for ${phoneNumber}: ${res.status} - ${err.substring(0, 100)}`);
      
      // Se erro 400/404, tentar próxima variante
      if (res.status === 400 || res.status === 404) {
        continue;
      }
      
      // Para outros erros (401, 500, etc), não tentar mais
      console.error(`❌ Error ${res.status}: ${err.substring(0, 200)}`);
      return false;
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

    let testMode = false, testPhone = null, testEmail = null, sendEmailFlag = true;
    
    try {
      const body = await req.json();
      testMode = body.testMode === true;
      testPhone = body.testPhone;
      testEmail = body.testEmail;
      sendEmailFlag = body.sendEmail !== false;
    } catch { /* No body */ }

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
    const message = formatReport(metrics, new Date());

    console.log('📊 Metrics:', { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate });

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
          report_type: 'daily',
          status: sent ? 'sent' : 'failed',
          message_content: message.substring(0, 500),
          metrics_snapshot: { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate },
        });
      }

      if (sendEmailFlag && r.email) {
        const dateStr = new Date().toLocaleDateString('pt-BR');
        const sent = await sendEmail(r.email, r.full_name, `📊 Relatório Gerencial - ${dateStr}`, message);
        if (sent) emailCount++;
      }

      if (i < recipients.length - 1 && r.whatsapp) {
        await delayMs(DELAY_BETWEEN_SENDS_MS);
      }
    }

    console.log(`📊 Done: ${sentCount} WhatsApp, ${emailCount} emails, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ success: true, sentCount, emailCount, errorCount, metrics: { totalActive: metrics.totalActive, sla: metrics.sla.onTimeRate } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
