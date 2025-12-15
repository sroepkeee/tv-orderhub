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

    // Verificar se o status está nas fases habilitadas
    const enabledPhases = agentConfig.notification_phases || [];
    if (payload.trigger_type === 'status_change' && payload.new_status) {
      const shouldNotify = checkStatusInPhases(payload.new_status, enabledPhases);
      if (!shouldNotify) {
        console.log('Status not in enabled phases:', payload.new_status);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Status not configured for notifications' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    // Buscar contato do cliente
    const { data: customerContact } = await supabase
      .from('customer_contacts')
      .select('*')
      .or(`customer_name.ilike.%${order.customer_name}%,customer_document.eq.${order.customer_document}`)
      .limit(1)
      .maybeSingle();

    // Se não encontrar contato, usar dados do pedido
    let contact = customerContact;
    if (!contact) {
      console.log('Customer contact not found, using order data');
      contact = {
        id: null,
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
        let externalMessageId = null;

        if (channel === 'whatsapp') {
          // Usar Mega API
          externalMessageId = await sendWhatsAppMessage(supabase, recipient, messageContent, logEntry.id);
          
          // Registrar na tabela de conversas para visualização unificada
          await registerConversation(supabase, order, recipient, messageContent, externalMessageId);
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

// Mapeamento de status para fases
const STATUS_PHASE_MAP: Record<string, string[]> = {
  order_created: ['almox_ssm_pending', 'almox_ssm_received'],
  in_production: ['separation_started', 'in_production'],
  production_completed: ['production_completed', 'separation_completed'],
  ready_for_shipping: ['ready_for_shipping', 'awaiting_pickup', 'pickup_scheduled'],
  in_transit: ['in_transit', 'collected'],
  delivered: ['delivered', 'completed'],
  delayed: ['delayed'],
};

function checkStatusInPhases(status: string, enabledPhases: string[]): boolean {
  for (const phase of enabledPhases) {
    const statuses = STATUS_PHASE_MAP[phase] || [];
    if (statuses.includes(status)) {
      return true;
    }
  }
  return false;
}

async function registerConversation(
  supabase: any,
  order: any,
  phoneNumber: string,
  message: string,
  externalMessageId: string | null
) {
  try {
    // Registrar como conversa com cliente (contact_type: 'customer')
    await supabase
      .from('carrier_conversations')
      .insert({
        carrier_id: order.id, // Usar order_id como referência (será usado para buscar conversas por pedido)
        order_id: order.id,
        message_content: message,
        message_direction: 'outbound',
        conversation_type: 'customer_notification',
        contact_type: 'customer',
        sent_at: new Date().toISOString(),
        n8n_message_id: externalMessageId,
        message_metadata: {
          customer_name: order.customer_name,
          customer_phone: phoneNumber,
          notification_type: 'ai_agent',
        },
      });
    console.log('Conversation registered successfully');
  } catch (error) {
    console.error('Error registering conversation:', error);
    // Não falhar a notificação por erro no registro da conversa
  }
}

async function sendWhatsAppMessage(
  supabase: any, 
  phone: string, 
  message: string, 
  logId: string
): Promise<string | null> {
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
  const externalMessageId = result.key?.id || result.messageId || null;
  
  // Atualizar log
  await supabase
    .from('ai_notification_log')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      external_message_id: externalMessageId,
    })
    .eq('id', logId);

  return externalMessageId;
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
