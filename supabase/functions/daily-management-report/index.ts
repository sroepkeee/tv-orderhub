import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderMetrics {
  totalActive: number;
  totalValue: number;
  byPhase: Record<string, number>;
  topOrders: Array<{
    orderNumber: string;
    customer: string;
    itemCount: number;
    totalValue: number;
    status: string;
    createdAt: string;
  }>;
  newToday: number;
  alerts: {
    delayed: number;
    critical: number;
    pendingLab: number;
  };
  phaseDetails: Array<{
    phase: string;
    count: number;
    orders: Array<{
      orderNumber: string;
      customer: string;
      createdAt: string;
    }>;
  }>;
}

const phaseLabels: Record<string, string> = {
  'almox_ssm_pending': 'Almox SSM - Pendente',
  'almox_ssm_received': 'Almox SSM - Recebido',
  'order_generation_pending': 'Gerar Ordem - Pendente',
  'order_in_creation': 'Ordem em Criação',
  'order_generated': 'Ordem Gerada',
  'almox_general_received': 'Almox Geral - Recebido',
  'almox_general_separating': 'Almox Geral - Separando',
  'almox_general_ready': 'Almox Geral - Pronto',
  'separation_started': 'Separação Iniciada',
  'in_production': 'Em Produção',
  'awaiting_material': 'Aguardando Material',
  'separation_completed': 'Separação Completa',
  'production_completed': 'Produção Completa',
  'awaiting_lab': 'Aguardando Lab',
  'in_lab_analysis': 'Em Análise Lab',
  'lab_completed': 'Lab Completo',
  'in_quality_check': 'Qualidade',
  'in_packaging': 'Embalagem',
  'ready_for_shipping': 'Pronto p/ Envio',
  'freight_quote_requested': 'Cotação Solicitada',
  'freight_quote_received': 'Cotação Recebida',
  'freight_approved': 'Frete Aprovado',
  'ready_to_invoice': 'Pronto p/ Faturar',
  'invoice_requested': 'NF Solicitada',
  'awaiting_invoice': 'Aguardando NF',
  'invoice_issued': 'NF Emitida',
  'invoice_sent': 'NF Enviada',
  'released_for_shipping': 'Liberado p/ Envio',
  'in_expedition': 'Em Expedição',
  'pickup_scheduled': 'Coleta Agendada',
  'awaiting_pickup': 'Aguardando Coleta',
  'in_transit': 'Em Trânsito',
  'collected': 'Coletado',
  'delivered': 'Entregue',
  'completed': 'Concluído',
};

function calculateMetrics(orders: any[]): OrderMetrics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const byPhase: Record<string, number> = {};
  const phaseOrders: Record<string, any[]> = {};
  let totalValue = 0;
  let newToday = 0;
  let delayed = 0;
  let critical = 0;
  let pendingLab = 0;

  orders.forEach(order => {
    // Count by phase
    const status = order.status || 'unknown';
    byPhase[status] = (byPhase[status] || 0) + 1;
    
    if (!phaseOrders[status]) phaseOrders[status] = [];
    phaseOrders[status].push(order);

    // Sum total value
    if (order.total_value) {
      totalValue += parseFloat(order.total_value);
    }

    // Check if new today
    const createdAt = new Date(order.created_at);
    createdAt.setHours(0, 0, 0, 0);
    if (createdAt.getTime() === today.getTime()) {
      newToday++;
    }

    // Check alerts
    if (order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      if (deliveryDate < today) {
        delayed++;
      }
      const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDelivery <= 2 && daysUntilDelivery >= 0) {
        critical++;
      }
    }

    if (status === 'awaiting_lab' || status === 'in_lab_analysis') {
      pendingLab++;
    }
  });

  // Top 5 orders by value
  const topOrders = orders
    .filter(o => o.total_value)
    .sort((a, b) => parseFloat(b.total_value) - parseFloat(a.total_value))
    .slice(0, 5)
    .map(o => ({
      orderNumber: o.order_number,
      customer: o.customer_name,
      itemCount: o.order_items?.length || 0,
      totalValue: parseFloat(o.total_value),
      status: phaseLabels[o.status] || o.status,
      createdAt: new Date(o.created_at).toLocaleDateString('pt-BR'),
    }));

  // Phase details with orders
  const phaseDetails = Object.entries(byPhase)
    .sort(([, a], [, b]) => b - a)
    .map(([phase, count]) => ({
      phase: phaseLabels[phase] || phase,
      count,
      orders: (phaseOrders[phase] || []).slice(0, 3).map(o => ({
        orderNumber: o.order_number,
        customer: o.customer_name,
        createdAt: new Date(o.created_at).toLocaleDateString('pt-BR'),
      })),
    }));

  return {
    totalActive: orders.length,
    totalValue,
    byPhase,
    topOrders,
    newToday,
    alerts: { delayed, critical, pendingLab },
    phaseDetails,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
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

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📈 *RESUMO GERAL*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `• Total de Pedidos Ativos: *${metrics.totalActive}*\n`;
  message += `• Valor Total em Produção: *${formatCurrency(metrics.totalValue)}*\n`;
  message += `• Novos Pedidos Hoje: *${metrics.newToday}*\n\n`;

  if (metrics.alerts.delayed > 0 || metrics.alerts.critical > 0) {
    message += `🚨 *ALERTAS*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (metrics.alerts.delayed > 0) {
      message += `⚠️ Pedidos Atrasados: *${metrics.alerts.delayed}*\n`;
    }
    if (metrics.alerts.critical > 0) {
      message += `🔴 Pedidos Críticos (< 2 dias): *${metrics.alerts.critical}*\n`;
    }
    if (metrics.alerts.pendingLab > 0) {
      message += `🔬 Aguardando Laboratório: *${metrics.alerts.pendingLab}*\n`;
    }
    message += `\n`;
  }

  message += `📦 *PEDIDOS POR FASE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  metrics.phaseDetails.slice(0, 8).forEach(phase => {
    message += `• ${phase.phase}: *${phase.count}*\n`;
  });
  message += `\n`;

  if (metrics.topOrders.length > 0) {
    message += `💰 *TOP 5 PEDIDOS (MAIOR VALOR)*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.topOrders.forEach((order, idx) => {
      message += `${idx + 1}. *${order.orderNumber}*\n`;
      message += `   👤 ${order.customer}\n`;
      message += `   📦 ${order.itemCount} itens | ${formatCurrency(order.totalValue)}\n`;
      message += `   📍 ${order.status}\n\n`;
    });
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🤖 _Relatório gerado automaticamente_\n`;
  message += `_Sistema de Gestão Imply_`;

  return message;
}

async function generateChart(metrics: OrderMetrics): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not configured, skipping chart generation');
      return null;
    }

    // Prepare data for chart prompt
    const phaseData = metrics.phaseDetails.slice(0, 6).map(p => `${p.phase}: ${p.count}`).join(', ');
    const date = new Date().toLocaleDateString('pt-BR');

    const prompt = `Create a professional pie chart with the following data for a business report:
${phaseData}

Requirements:
- Modern, clean corporate style
- Use vibrant but professional colors (blue, green, orange, purple, teal)
- Title: "Distribuição de Pedidos por Fase"
- Subtitle: "Relatório ${date}"
- Show percentages on each slice
- Add a legend on the right side
- White background
- High resolution, suitable for WhatsApp
- Dimensions: 800x600 pixels`;

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
      console.error('Chart generation failed:', response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      // Extract base64 data
      const base64Data = imageUrl.split(',')[1];
      return base64Data;
    }

    return null;
  } catch (error) {
    console.error('Error generating chart:', error);
    return null;
  }
}

async function sendWhatsAppMessage(
  supabaseClient: any,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.functions.invoke('mega-api-send', {
      body: { phoneNumber: phone, message },
    });

    if (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }

    console.log('WhatsApp message sent successfully to:', phone);
    return true;
  } catch (error) {
    console.error('Error calling mega-api-send:', error);
    return false;
  }
}

async function sendWhatsAppImage(
  supabaseClient: any,
  phone: string,
  base64Data: string,
  caption: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.functions.invoke('mega-api-send-media', {
      body: {
        phoneNumber: phone,
        mediaType: 'image',
        base64Data,
        caption,
        fileName: 'relatorio-diario.png',
      },
    });

    if (error) {
      console.error('Error sending WhatsApp image:', error);
      return false;
    }

    console.log('WhatsApp image sent successfully to:', phone);
    return true;
  } catch (error) {
    console.error('Error calling mega-api-send-media:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting daily management report generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional parameters
    let includeChart = true;
    let testMode = false;
    let testPhone = null;

    try {
      const body = await req.json();
      includeChart = body.includeChart !== false;
      testMode = body.testMode === true;
      testPhone = body.testPhone;
    } catch {
      // No body provided, use defaults
    }

    // 1. Get active recipients
    let recipients: any[] = [];
    
    if (testMode && testPhone) {
      // Test mode - send only to specific number
      recipients = [{ whatsapp: testPhone, id: null }];
      console.log('🧪 Test mode - sending to:', testPhone);
    } else {
      const { data: recipientsData, error: recipientsError } = await supabaseClient
        .from('management_report_recipients')
        .select('id, whatsapp, user_id')
        .eq('is_active', true)
        .contains('report_types', ['daily']);

      if (recipientsError) {
        console.error('Error fetching recipients:', recipientsError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch recipients' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      recipients = recipientsData || [];
    }

    if (recipients.length === 0) {
      console.log('No active recipients found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active recipients', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Found ${recipients.length} recipients`);

    // 2. Fetch active orders with items
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        status,
        total_value,
        delivery_date,
        created_at,
        order_items(id, item_code, item_description)
      `)
      .not('status', 'in', '("completed","cancelled","delivered")');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Found ${orders?.length || 0} active orders`);

    // 3. Calculate metrics
    const metrics = calculateMetrics(orders || []);
    const reportDate = new Date();
    const message = formatReportMessage(metrics, reportDate);

    console.log('📊 Metrics calculated:', {
      totalActive: metrics.totalActive,
      totalValue: metrics.totalValue,
      newToday: metrics.newToday,
      alerts: metrics.alerts,
    });

    // 4. Generate chart if enabled
    let chartBase64: string | null = null;
    if (includeChart) {
      console.log('🎨 Generating chart...');
      chartBase64 = await generateChart(metrics);
      if (chartBase64) {
        console.log('✅ Chart generated successfully');
      } else {
        console.log('⚠️ Chart generation skipped or failed');
      }
    }

    // 5. Send to all recipients
    let sentCount = 0;
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        // Send text message
        const messageSent = await sendWhatsAppMessage(supabaseClient, recipient.whatsapp, message);
        
        // Send chart if available
        let chartSent = false;
        if (chartBase64 && messageSent) {
          chartSent = await sendWhatsAppImage(
            supabaseClient,
            recipient.whatsapp,
            chartBase64,
            '📊 Gráfico de Distribuição por Fase'
          );
        }

        // Log the report
        if (!testMode) {
          await supabaseClient.from('management_report_log').insert({
            report_type: 'daily',
            recipient_id: recipient.id,
            recipient_whatsapp: recipient.whatsapp,
            message_content: message,
            chart_sent: chartSent,
            metrics_snapshot: metrics,
            status: messageSent ? 'sent' : 'failed',
          });

          // Update last_report_sent_at
          if (recipient.id) {
            await supabaseClient
              .from('management_report_recipients')
              .update({ last_report_sent_at: new Date().toISOString() })
              .eq('id', recipient.id);
          }
        }

        if (messageSent) {
          sentCount++;
          console.log(`✅ Report sent to ${recipient.whatsapp}`);
        } else {
          errorCount++;
          console.log(`❌ Failed to send to ${recipient.whatsapp}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error sending to ${recipient.whatsapp}:`, error);
      }
    }

    console.log(`📊 Report complete: ${sentCount} sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        errorCount,
        metrics: {
          totalActive: metrics.totalActive,
          totalValue: metrics.totalValue,
          newToday: metrics.newToday,
          alerts: metrics.alerts,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in daily-management-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
