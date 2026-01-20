import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderMetrics {
  totalOrders: number;
  totalValue: number;
  newToday: number;
  slaOntime: number;
  slaLate: number;
  phaseDistribution: Record<string, number>;
  bottlenecks: Array<{ phase: string; count: number; avgDays: number }>;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  delivery_date: string | null;
  order_value: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
}

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  is_active: boolean;
  status: string;
}

// Status to phase mapping for customer notifications
const STATUS_TO_NOTIFICATION_PHASE: Record<string, string> = {
  'almox_ssm_pending': 'order_created',
  'almox_ssm_received': 'order_created',
  'separation_started': 'in_production',
  'in_production': 'in_production',
  'production_completed': 'production_completed',
  'separation_completed': 'production_completed',
  'ready_for_shipping': 'ready_for_shipping',
  'awaiting_pickup': 'ready_for_shipping',
  'pickup_scheduled': 'ready_for_shipping',
  'in_transit': 'in_transit',
  'collected': 'in_transit',
  'delivered': 'delivered',
  'completed': 'delivered',
  'delayed': 'delayed',
  'ready_to_invoice': 'ready_to_invoice',
  'pending_invoice_request': 'ready_to_invoice',
  'invoice_requested': 'invoicing',
  'awaiting_invoice': 'invoicing',
  'invoice_issued': 'invoicing',
  'invoice_sent': 'invoicing',
};

const phaseLabels: Record<string, string> = {
  'ordem_gerada': 'Ordem Gerada',
  'aguardando_compras': 'Aguardando Compras',
  'em_producao': 'Em Produção',
  'aguardando_laboratorio': 'Aguardando Laboratório',
  'em_laboratorio': 'Em Laboratório',
  'aguardando_frete': 'Aguardando Frete',
  'em_transito': 'Em Trânsito',
  'entregue': 'Entregue',
  'concluido': 'Concluído'
};

const statusToPhase: Record<string, string> = {
  'ordem_gerada': 'ordem_gerada',
  'aguardando_insumos': 'aguardando_compras',
  'em_producao': 'em_producao',
  'disponivel_para_laboratorio': 'aguardando_laboratorio',
  'em_laboratorio': 'em_laboratorio',
  'disponivel_para_transporte': 'aguardando_frete',
  'em_transito': 'em_transito',
  'entregue': 'entregue',
  'concluido': 'concluido',
  'cancelado': 'cancelado'
};

// Customer notification phase labels
const NOTIFICATION_PHASE_LABELS: Record<string, string> = {
  'order_created': 'Pedido Criado',
  'in_production': 'Em Produção',
  'production_completed': 'Produção Concluída',
  'ready_for_shipping': 'Pronto para Envio',
  'in_transit': 'Em Trânsito',
  'delivered': 'Entregue',
  'delayed': 'Atrasado',
  'ready_to_invoice': 'À Faturar',
  'invoicing': 'Faturamento',
};

async function calculateMetrics(supabase: any, organizationId?: string): Promise<OrderMetrics> {
  let query = supabase
    .from('orders')
    .select('id, status, created_at, delivery_date, order_value')
    .not('status', 'in', '("concluido","cancelado")');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  const orderList = (orders || []) as Order[];
  const today = new Date().toISOString().split('T')[0];
  const newToday = orderList.filter(o => o.created_at?.startsWith(today)).length;
  
  let slaOntime = 0;
  let slaLate = 0;
  const phaseDistribution: Record<string, number> = {};
  const phaseTimes: Record<string, { total: number; count: number }> = {};

  orderList.forEach(order => {
    // SLA calculation
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      const now = new Date();
      if (deliveryDate >= now) {
        slaOntime++;
      } else {
        slaLate++;
      }
    }

    // Phase distribution
    const phase = statusToPhase[order.status] || order.status;
    phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;

    // Phase time calculation
    if (order.created_at) {
      const createdAt = new Date(order.created_at);
      const now = new Date();
      const daysInPhase = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (!phaseTimes[phase]) {
        phaseTimes[phase] = { total: 0, count: 0 };
      }
      phaseTimes[phase].total += daysInPhase;
      phaseTimes[phase].count++;
    }
  });

  // Calculate bottlenecks
  const bottlenecks = Object.entries(phaseTimes)
    .map(([phase, data]) => ({
      phase,
      count: phaseDistribution[phase] || 0,
      avgDays: data.count > 0 ? Math.round(data.total / data.count) : 0
    }))
    .filter(b => b.avgDays > 3) // More than 3 days is a bottleneck
    .sort((a, b) => b.avgDays - a.avgDays);

  const totalValue = orderList.reduce((sum, o) => sum + (parseFloat(o.order_value || '0') || 0), 0);

  return {
    totalOrders: orderList.length,
    totalValue,
    newToday,
    slaOntime,
    slaLate,
    phaseDistribution,
    bottlenecks
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatReportMessage(template: string, metrics: OrderMetrics, date: string): string {
  const total = metrics.slaOntime + metrics.slaLate;
  const slaOntimePct = total > 0 ? Math.round((metrics.slaOntime / total) * 100) : 100;
  const slaLatePct = total > 0 ? Math.round((metrics.slaLate / total) * 100) : 0;

  const phaseSummary = Object.entries(metrics.phaseDistribution)
    .map(([phase, count]) => `• ${phaseLabels[phase] || phase}: ${count}`)
    .join('\n');

  const alerts = metrics.bottlenecks.length > 0
    ? '⚠️ *Gargalos detectados:*\n' + metrics.bottlenecks
        .slice(0, 3)
        .map(b => `• ${phaseLabels[b.phase] || b.phase}: ${b.count} pedidos (${b.avgDays} dias)`)
        .join('\n')
    : '✅ Nenhum gargalo significativo';

  return template
    .replace('{{date}}', date)
    .replace('{{total_orders}}', metrics.totalOrders.toString())
    .replace('{{total_value}}', formatCurrency(metrics.totalValue))
    .replace('{{new_today}}', metrics.newToday.toString())
    .replace('{{sla_ontime}}', metrics.slaOntime.toString())
    .replace('{{sla_ontime_pct}}', slaOntimePct.toString())
    .replace('{{sla_late}}', metrics.slaLate.toString())
    .replace('{{sla_late_pct}}', slaLatePct.toString())
    .replace('{{phase_summary}}', phaseSummary)
    .replace('{{alerts}}', alerts);
}

function formatCustomerNotificationMessage(order: Order, phase: string): string {
  const phaseLabel = NOTIFICATION_PHASE_LABELS[phase] || phase;
  const customerName = order.customer_name || 'Cliente';
  const orderNumber = order.order_number || order.id.slice(0, 8);
  
  // Template messages for each phase
  const templates: Record<string, string> = {
    'order_created': `Olá ${customerName}! 👋\n\nSeu pedido *#${orderNumber}* foi recebido e registrado em nosso sistema.\n\nAcompanhe o status do seu pedido. Qualquer dúvida, estamos à disposição!`,
    'in_production': `Olá ${customerName}! 🔧\n\nSeu pedido *#${orderNumber}* entrou em produção!\n\nEm breve você receberá atualizações sobre o andamento.`,
    'production_completed': `Olá ${customerName}! ✅\n\nA produção do seu pedido *#${orderNumber}* foi concluída!\n\nAgora ele seguirá para as próximas etapas antes do envio.`,
    'ready_for_shipping': `Olá ${customerName}! 📦\n\nSeu pedido *#${orderNumber}* está pronto para envio!\n\nEm breve ele será despachado e você receberá o código de rastreamento.`,
    'in_transit': `Olá ${customerName}! 🚚\n\nÓtimas notícias! Seu pedido *#${orderNumber}* saiu para entrega!\n\nAcompanhe o rastreamento para mais detalhes.`,
    'delivered': `Olá ${customerName}! 🎉\n\nSeu pedido *#${orderNumber}* foi entregue!\n\nEsperamos que esteja satisfeito. Qualquer dúvida, estamos à disposição!`,
    'delayed': `Olá ${customerName}! ⚠️\n\nInformamos que houve um atraso no seu pedido *#${orderNumber}*.\n\nEstamos trabalhando para resolver o mais rápido possível. Pedimos desculpas pelo transtorno.`,
    'ready_to_invoice': `Olá ${customerName}! 📋\n\nSeu pedido *#${orderNumber}* está pronto para faturamento!\n\nEm breve você receberá a nota fiscal.`,
    'invoicing': `Olá ${customerName}! 📄\n\nSeu pedido *#${orderNumber}* foi faturado!\n\nA nota fiscal será enviada em breve.`,
  };
  
  return templates[phase] || `Olá ${customerName}!\n\nSeu pedido *#${orderNumber}* está na fase: ${phaseLabel}`;
}

async function generateChart(supabase: any, chartType: string, dataSource: string, metrics: OrderMetrics, provider: string): Promise<string | null> {
  try {
    let chartData;

    if (dataSource === 'phase_distribution') {
      const labels = Object.keys(metrics.phaseDistribution).map(k => phaseLabels[k] || k);
      const data = Object.values(metrics.phaseDistribution);
      chartData = {
        chartType: 'pie',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
          }]
        },
        options: { title: 'Distribuição por Fase', width: 500, height: 300 },
        provider
      };
    } else if (dataSource === 'sla_compliance') {
      const total = metrics.slaOntime + metrics.slaLate;
      const slaPercentage = total > 0 ? Math.round((metrics.slaOntime / total) * 100) : 100;
      chartData = {
        chartType: 'gauge',
        data: {
          labels: ['SLA'],
          datasets: [{ data: [slaPercentage] }]
        },
        options: { title: 'Conformidade SLA', width: 400, height: 200 },
        provider
      };
    } else {
      return null;
    }

    const response = await supabase.functions.invoke('generate-chart', {
      body: chartData
    });

    if (response.error) {
      console.error('Chart generation error:', response.error);
      return null;
    }

    return response.data?.imageBase64 || null;
  } catch (error) {
    console.error('Error generating chart:', error);
    return null;
  }
}

async function queueWhatsAppMessage(supabase: any, phone: string, message: string, scheduleId: string, recipientName: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const { error } = await supabase
      .from('message_queue')
      .insert({
        recipient_whatsapp: normalizedPhone,
        recipient_name: recipientName,
        message_type: 'scheduled_report',
        message_content: message,
        priority: 3, // Normal priority for reports
        status: 'pending',
        scheduled_for: null,
        attempts: 0,
        max_attempts: 3,
        metadata: {
          source: 'send-scheduled-reports',
          schedule_id: scheduleId,
          queued_at: new Date().toISOString(),
        },
      });

    return !error;
  } catch (error) {
    console.error('Error queuing WhatsApp message:', error);
    return false;
  }
}

async function queueWhatsAppImage(supabase: any, phone: string, imageBase64: string, scheduleId: string, recipientName: string, caption?: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const { error } = await supabase
      .from('message_queue')
      .insert({
        recipient_whatsapp: normalizedPhone,
        recipient_name: recipientName,
        message_type: 'scheduled_report_image',
        message_content: caption || 'Relatório',
        media_base64: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        media_caption: caption || '',
        priority: 3,
        status: 'pending',
        scheduled_for: null,
        attempts: 0,
        max_attempts: 3,
        metadata: {
          source: 'send-scheduled-reports',
          schedule_id: scheduleId,
          queued_at: new Date().toISOString(),
        },
      });

    return !error;
  } catch (error) {
    console.error('Error queuing WhatsApp image:', error);
    return false;
  }
}

// Get orders in specific phases for customer notifications
async function getOrdersInPhases(supabase: any, phases: string[], organizationId?: string): Promise<Order[]> {
  // Map phases to statuses
  const statuses: string[] = [];
  for (const [status, phase] of Object.entries(STATUS_TO_NOTIFICATION_PHASE)) {
    if (phases.includes(phase)) {
      statuses.push(status);
    }
  }

  if (statuses.length === 0) {
    return [];
  }

  let query = supabase
    .from('orders')
    .select('id, order_number, status, created_at, delivery_date, order_value, customer_name, customer_whatsapp')
    .in('status', statuses);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching orders in phases:', error);
    return [];
  }

  return (data || []).filter((o: Order) => o.customer_whatsapp);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { scheduleId, testMode, testPhone } = body;

    console.log('Processing scheduled reports...', { scheduleId, testMode });

    // Get schedules to process
    let query = supabase
      .from('report_schedules')
      .select(`
        *,
        template:report_templates(*)
      `)
      .eq('is_active', true);

    if (scheduleId) {
      query = query.eq('id', scheduleId);
    } else {
      // Get schedules that are due now
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
      
      query = query
        .lte('send_time', `${currentTime}:59`)
        .gte('send_time', `${currentTime}:00`)
        .contains('send_days', [currentDay]);
    }

    const { data: schedules, error: schedulesError } = await query;

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} schedules to process`);

    const results: Array<{ scheduleId: string; sent: number; failed: number; recipientType: string }> = [];

    for (const schedule of schedules || []) {
      const recipientType = schedule.recipient_type || 'managers';
      console.log(`Processing schedule ${schedule.id} for ${recipientType}`);

      if (recipientType === 'customers') {
        // Handle customer notifications
        const phases = schedule.customer_notification_phases || [];
        if (phases.length === 0) {
          console.log('No customer notification phases configured, skipping');
          continue;
        }

        const orders = await getOrdersInPhases(supabase, phases, schedule.organization_id);
        console.log(`Found ${orders.length} orders to notify customers`);

        let sent = 0;
        let failed = 0;

        for (const order of orders) {
          const phase = STATUS_TO_NOTIFICATION_PHASE[order.status];
          if (!phase || !phases.includes(phase)) continue;

          const phone = testMode && testPhone ? testPhone : order.customer_whatsapp;
          if (!phone) continue;

          const message = formatCustomerNotificationMessage(order, phase);
          const success = await sendWhatsAppMessage(supabase, phone, message);

          if (success) {
            sent++;
            // Log the notification
            await supabase.from('ai_notification_log').insert({
              channel: 'whatsapp',
              recipient: phone,
              message_content: message,
              status: 'sent',
              order_id: order.id,
              metadata: {
                schedule_id: schedule.id,
                notification_phase: phase,
                recipient_type: 'customer',
              }
            });
          } else {
            failed++;
          }

          // Avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

          // In test mode, only send one
          if (testMode) break;
        }

        results.push({ scheduleId: schedule.id, sent, failed, recipientType: 'customers' });

      } else {
        // Handle manager reports (existing logic)
        const template = schedule.template;
        if (!template) {
          console.warn(`No template found for schedule ${schedule.id}`);
          continue;
        }

        // Calculate metrics for this organization
        const metrics = await calculateMetrics(supabase, schedule.organization_id);
        
        const today = new Date().toLocaleDateString('pt-BR');
        const message = formatReportMessage(template.message_template || '', metrics, today);

        // Generate charts if needed
        const charts: string[] = [];
        if (schedule.include_charts && template.charts) {
          for (const chartConfig of template.charts) {
            const chartBase64 = await generateChart(
              supabase,
              chartConfig.type,
              chartConfig.data_source,
              metrics,
              schedule.chart_provider
            );
            if (chartBase64) {
              charts.push(chartBase64);
            }
          }
        }

        // Get recipients from management_report_recipients or schedule
        let recipients: Array<{ whatsapp: string; name: string }> = [];
        
        if (testMode && testPhone) {
          recipients = [{ whatsapp: testPhone, name: 'Test' }];
        } else if (schedule.recipients && schedule.recipients.length > 0) {
          recipients = schedule.recipients as Array<{ whatsapp: string; name: string }>;
        } else {
          // Fetch from management_report_recipients
          const { data: reportRecipients } = await supabase
            .from('management_report_recipients')
            .select('whatsapp, user_id, profiles(full_name)')
            .eq('is_active', true);

          if (reportRecipients) {
            recipients = reportRecipients
              .filter((r: any) => r.whatsapp)
              .map((r: any) => ({
                whatsapp: r.whatsapp,
                name: r.profiles?.full_name || 'Gestor'
              }));
          }
        }

        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
          const success = await queueWhatsAppMessage(supabase, recipient.whatsapp, message, schedule.id, recipient.name);
          
          if (success) {
            // Queue charts
            for (const chart of charts) {
              await queueWhatsAppImage(supabase, recipient.whatsapp, chart, schedule.id, recipient.name, 'Gráfico do Relatório');
            }
            sent++;
          } else {
            failed++;
          }

          // Log the send
          await supabase.from('report_send_log').insert({
            organization_id: schedule.organization_id,
            schedule_id: schedule.id,
            template_id: template.id,
            recipient_whatsapp: recipient.whatsapp,
            recipient_name: recipient.name,
            status: success ? 'sent' : 'failed',
            message_content: message,
            charts_sent: charts.length,
            metrics_snapshot: metrics,
            error_message: success ? null : 'Failed to send message'
          });
        }

        results.push({ scheduleId: schedule.id, sent, failed, recipientType: 'managers' });
      }

      // Update schedule last_sent_at
      await supabase
        .from('report_schedules')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', schedule.id);
    }

    console.log('Report processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing scheduled reports:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
