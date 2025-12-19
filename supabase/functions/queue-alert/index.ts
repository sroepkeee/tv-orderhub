import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertRequest {
  alertType: 'delayed_order' | 'critical_sla' | 'large_order' | 'production_issue' | 'custom';
  priority?: 1 | 2 | 3; // 1=Crítico, 2=Alto, 3=Normal
  orderId?: string;
  orderNumber?: string;
  customMessage?: string;
  metadata?: Record<string, any>;
  recipientWhatsapp?: string; // Se não fornecido, envia para todos os gestores
}

// Templates de alertas
const alertTemplates: Record<string, (data: any) => string> = {
  delayed_order: (data) => `
🚨 *ALERTA: PEDIDO ATRASADO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: *#${data.orderNumber}*
👤 Cliente: ${data.customerName}
📅 Previsão: ${data.deliveryDate}
⏱️ Atraso: *${data.daysDelayed} dias*
📍 Status: ${data.status}
💰 Valor: ${data.totalValue}

⚠️ _Ação requerida imediatamente!_
`.trim(),

  critical_sla: (data) => `
⚠️ *ALERTA: SLA CRÍTICO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: *#${data.orderNumber}*
👤 Cliente: ${data.customerName}
📅 Vence em: *${data.daysRemaining} dia(s)*
📍 Status: ${data.status}

🔔 _Priorizar imediatamente!_
`.trim(),

  large_order: (data) => `
💰 *NOVO PEDIDO DE ALTO VALOR*
━━━━━━━━━━━━━━━━━━
📦 Pedido: *#${data.orderNumber}*
👤 Cliente: ${data.customerName}
💵 Valor: *${data.totalValue}*
📋 Itens: ${data.itemCount}
📅 Previsão: ${data.deliveryDate}

✨ _Acompanhar de perto!_
`.trim(),

  production_issue: (data) => `
🔧 *ALERTA: PROBLEMA NA PRODUÇÃO*
━━━━━━━━━━━━━━━━━━
📦 Pedido: *#${data.orderNumber}*
👤 Cliente: ${data.customerName}
⚠️ Problema: ${data.issue}
📍 Fase: ${data.phase}

🛠️ _Verificar urgentemente!_
`.trim(),

  custom: (data) => data.message || 'Alerta do sistema',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AlertRequest = await req.json();
    console.log('📥 Received alert request:', body.alertType);

    const { 
      alertType, 
      priority = 2, 
      orderId, 
      orderNumber, 
      customMessage,
      metadata = {},
      recipientWhatsapp 
    } = body;

    // Buscar dados do pedido se fornecido
    let orderData: any = null;
    if (orderId || orderNumber) {
      const query = supabase
        .from('orders')
        .select('id, order_number, customer_name, status, total_value, delivery_date, order_items(id)')
        .limit(1);
      
      if (orderId) {
        query.eq('id', orderId);
      } else if (orderNumber) {
        query.eq('order_number', orderNumber);
      }

      const { data, error } = await query.single();
      if (error) {
        console.error('Error fetching order:', error);
      } else {
        orderData = data;
      }
    }

    // Preparar dados para o template
    const templateData = {
      orderNumber: orderData?.order_number || orderNumber || 'N/A',
      customerName: orderData?.customer_name || 'N/A',
      status: orderData?.status || 'N/A',
      totalValue: orderData?.total_value 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orderData.total_value)
        : 'N/A',
      deliveryDate: orderData?.delivery_date 
        ? new Date(orderData.delivery_date).toLocaleDateString('pt-BR')
        : 'N/A',
      itemCount: orderData?.order_items?.length || 0,
      daysDelayed: orderData?.delivery_date 
        ? Math.max(0, Math.floor((Date.now() - new Date(orderData.delivery_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
      daysRemaining: orderData?.delivery_date 
        ? Math.max(0, Math.floor((new Date(orderData.delivery_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0,
      message: customMessage,
      ...metadata,
    };

    // Gerar mensagem do alerta
    const template = alertTemplates[alertType] || alertTemplates.custom;
    const messageContent = template(templateData);

    // Buscar destinatários
    let recipients: Array<{ whatsapp: string; name?: string }> = [];

    if (recipientWhatsapp) {
      // Destinatário específico
      recipients = [{ whatsapp: recipientWhatsapp }];
    } else {
      // Todos os gestores ativos
      const { data: managersData, error: managersError } = await supabase
        .from('management_report_recipients')
        .select('whatsapp, user_id, profiles:user_id(full_name)')
        .eq('is_active', true);

      if (managersError) {
        console.error('Error fetching managers:', managersError);
        throw managersError;
      }

      recipients = (managersData || []).map((m: any) => ({
        whatsapp: m.whatsapp,
        name: m.profiles?.full_name || null,
      }));
    }

    if (recipients.length === 0) {
      console.log('⚠️ No recipients found for alert');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients found', queued: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Queueing alert for ${recipients.length} recipient(s)`);

    // Adicionar alertas à fila com escalonamento temporal
    const queueEntries = recipients.map((recipient, index) => ({
      recipient_whatsapp: recipient.whatsapp,
      recipient_name: recipient.name || null,
      message_type: alertType,
      message_content: messageContent,
      priority,
      status: 'pending',
      // Escalonar envios: 5 segundos entre cada destinatário
      scheduled_for: new Date(Date.now() + (index * 5000)).toISOString(),
      metadata: {
        order_id: orderData?.id || orderId,
        order_number: orderData?.order_number || orderNumber,
        alert_type: alertType,
        ...metadata,
      },
    }));

    const { data: insertedMessages, error: insertError } = await supabase
      .from('message_queue')
      .insert(queueEntries)
      .select('id');

    if (insertError) {
      console.error('Error inserting to queue:', insertError);
      throw insertError;
    }

    console.log(`✅ Queued ${insertedMessages?.length || 0} alert messages`);

    return new Response(
      JSON.stringify({
        success: true,
        queued: insertedMessages?.length || 0,
        alertType,
        priority,
        recipients: recipients.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in queue-alert:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
