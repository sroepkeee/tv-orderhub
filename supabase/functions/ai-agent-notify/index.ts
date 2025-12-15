import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  order_id: string;
  trigger_type: 'status_change' | 'deadline' | 'manual';
  new_status?: string;
  custom_message?: string;
  channel?: 'whatsapp' | 'email' | 'both';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationRequest = await req.json();
    console.log('AI Agent Notify - Payload:', payload);

    // Buscar configuração do agente
    const { data: agentConfig } = await supabase
      .from('ai_agent_config')
      .select('*')
      .limit(1)
      .single();

    if (!agentConfig?.is_active) {
      console.log('AI Agent is not active');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'AI Agent is not active' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar pedido
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('id', payload.order_id)
      .single();

    if (!order) {
      throw new Error('Order not found');
    }

    // Buscar regra de notificação aplicável
    let notificationRule = null;
    if (payload.trigger_type === 'status_change' && payload.new_status) {
      const { data: rules } = await supabase
        .from('ai_notification_rules')
        .select('*, template:ai_notification_templates(*)')
        .eq('trigger_type', 'status_change')
        .eq('trigger_status', payload.new_status)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1);

      notificationRule = rules?.[0];
    }

    if (!notificationRule && payload.trigger_type !== 'manual') {
      console.log('No matching notification rule found');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No matching notification rule' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar contato do cliente
    const { data: customerContact } = await supabase
      .from('customer_contacts')
      .select('*')
      .or(`customer_name.ilike.%${order.customer_name}%,customer_document.eq.${order.customer_document}`)
      .limit(1)
      .single();

    // Se não encontrar contato, criar um baseado no pedido
    let contact = customerContact;
    if (!contact) {
      console.log('Customer contact not found, using order data');
      contact = {
        customer_name: order.customer_name,
        email: null,
        whatsapp: null,
        preferred_channel: 'whatsapp',
        opt_in_whatsapp: true,
        opt_in_email: true,
      };
    }

    // Verificar opt-in
    const channels = payload.channel === 'both' 
      ? ['whatsapp', 'email'] 
      : payload.channel 
        ? [payload.channel] 
        : notificationRule?.channels || ['whatsapp'];

    const results = [];

    for (const channel of channels) {
      if (channel === 'whatsapp' && !contact.opt_in_whatsapp) continue;
      if (channel === 'email' && !contact.opt_in_email) continue;
      if (channel === 'whatsapp' && !agentConfig.whatsapp_enabled) continue;
      if (channel === 'email' && !agentConfig.email_enabled) continue;

      // Buscar template apropriado
      let template = notificationRule?.template;
      if (!template) {
        const { data: templates } = await supabase
          .from('ai_notification_templates')
          .select('*')
          .eq('channel', channel)
          .eq('is_active', true)
          .limit(1);
        template = templates?.[0];
      }

      if (!template) {
        console.log(`No template found for channel: ${channel}`);
        continue;
      }

      // Preparar variáveis
      const variables: Record<string, string> = {
        customer_name: contact.customer_name || order.customer_name,
        order_number: order.order_number,
        items_count: String(order.order_items?.length || 0),
        delivery_date: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'A definir',
        carrier_name: order.carrier_name || 'A definir',
        tracking_code: order.tracking_code || 'Não disponível',
        signature: agentConfig.signature || 'Equipe Imply',
        status: order.status,
      };

      // Substituir variáveis no template
      let messageContent = payload.custom_message || template.content;
      for (const [key, value] of Object.entries(variables)) {
        messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      let subject = template.subject;
      if (subject) {
        for (const [key, value] of Object.entries(variables)) {
          subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
      }

      // Determinar destinatário
      const recipient = channel === 'whatsapp' ? contact.whatsapp : contact.email;
      if (!recipient) {
        console.log(`No ${channel} contact for customer`);
        continue;
      }

      // Registrar no log
      const { data: logEntry } = await supabase
        .from('ai_notification_log')
        .insert({
          order_id: order.id,
          customer_contact_id: customerContact?.id,
          rule_id: notificationRule?.id,
          template_id: template.id,
          channel,
          recipient,
          subject,
          message_content: messageContent,
          status: 'pending',
          metadata: { variables, trigger_type: payload.trigger_type },
        })
        .select()
        .single();

      // Enviar notificação
      try {
        if (channel === 'whatsapp') {
          // Usar Mega API
          await sendWhatsAppMessage(supabase, recipient, messageContent, logEntry.id);
        } else if (channel === 'email') {
          // Usar Resend
          await sendEmailMessage(recipient, subject || 'Atualização do seu pedido', messageContent, logEntry.id, supabase);
        }

        results.push({ channel, status: 'sent', recipient });
      } catch (sendError: any) {
        console.error(`Error sending ${channel}:`, sendError);
        await supabase
          .from('ai_notification_log')
          .update({ 
            status: 'failed', 
            error_message: sendError?.message || 'Unknown error'
          })
          .eq('id', logEntry.id);
        
        results.push({ channel, status: 'failed', error: sendError?.message || 'Unknown error' });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('AI Agent Notify Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendWhatsAppMessage(
  supabase: any, 
  phone: string, 
  message: string, 
  logId: string
) {
  // Buscar instância conectada
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .limit(1)
    .single();

  if (!instance) {
    throw new Error('No connected WhatsApp instance');
  }

  const megaApiUrl = Deno.env.get('MEGA_API_URL');
  const megaApiToken = Deno.env.get('MEGA_API_TOKEN');

  if (!megaApiUrl || !megaApiToken) {
    throw new Error('Mega API not configured');
  }

  // Normalizar URL
  let baseUrl = megaApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  // Formatar número
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const response = await fetch(`${baseUrl}/message/sendText/${instance.instance_key}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': megaApiToken,
    },
    body: JSON.stringify({
      number: formattedPhone,
      textMessage: { text: message },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mega API error: ${errorText}`);
  }

  const result = await response.json();
  
  // Atualizar log
  await supabase
    .from('ai_notification_log')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      external_message_id: result.key?.id || result.messageId,
    })
    .eq('id', logId);

  return result;
}

async function sendEmailMessage(
  to: string, 
  subject: string, 
  htmlContent: string, 
  logId: string,
  supabase: any
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    throw new Error('Resend API key not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Imply Tecnologia <noreply@imply.com>',
      to: [to],
      subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${errorText}`);
  }

  const result = await response.json();
  
  // Atualizar log
  await supabase
    .from('ai_notification_log')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      external_message_id: result.id,
    })
    .eq('id', logId);

  return result;
}
