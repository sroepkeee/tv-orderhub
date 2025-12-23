import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  order_id?: string;
  trigger_type?: 'status_change' | 'deadline' | 'manual';
  new_status?: string;
  custom_message?: string;
  channel?: 'whatsapp' | 'email' | 'both';
  // Para reenvio
  action?: 'resend';
  notificationId?: string;
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
    console.log('📬 AI Agent Notify - Payload:', payload);

    // 🔄 Handler para reenvio de notificação
    if (payload.action === 'resend' && payload.notificationId) {
      console.log('🔄 Resending notification:', payload.notificationId);
      
      // Buscar notificação original
      const { data: notification, error: notifError } = await supabase
        .from('ai_notification_log')
        .select('*')
        .eq('id', payload.notificationId)
        .single();

      if (notifError || !notification) {
        throw new Error('Notification not found: ' + (notifError?.message || 'Unknown error'));
      }

      console.log('📋 Original notification:', notification.channel, notification.recipient);

      // Reenviar baseado no canal
      if (notification.channel === 'whatsapp') {
        try {
          await sendWhatsAppMessage(
            supabase, 
            notification.recipient, 
            notification.message_content, 
            notification.id
          );
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Notification resent successfully' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (resendError) {
          console.error('❌ Resend failed:', resendError);
          return new Response(JSON.stringify({ 
            success: false, 
            message: resendError instanceof Error ? resendError.message : 'Resend failed'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Email resend not implemented yet' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // =====================================================
    // FLUXO NORMAL: Notificação baseada em order_id
    // =====================================================
    
    if (!payload.order_id) {
      throw new Error('order_id is required for new notifications');
    }

    // Buscar configuração do agente de clientes
    const { data: agentConfig } = await supabase
      .from('ai_agent_config')
      .select('*')
      .eq('agent_type', 'customer')
      .limit(1)
      .single();

    if (!agentConfig?.is_active) {
      console.log('❌ AI Agent (customer) is not active');
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
        console.log('⏭️ Status not in enabled phases:', payload.new_status, 'Enabled:', enabledPhases);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Status not configured for notifications' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Buscar pedido com campo customer_whatsapp
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('id', payload.order_id)
      .single();

    if (!order) {
      throw new Error('Order not found');
    }

    console.log('📦 Order found:', order.order_number, 'Customer:', order.customer_name);

    // 🔍 BUSCA MELHORADA DO CLIENTE
    let customerContact = null;
    let contactSource = '';

    // 1. Primeiro: buscar por documento (mais preciso)
    if (order.customer_document) {
      const { data: contactByDoc } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_document', order.customer_document)
        .limit(1)
        .maybeSingle();
      
      if (contactByDoc) {
        customerContact = contactByDoc;
        contactSource = 'document';
        console.log('✅ Customer found by document:', contactByDoc.customer_name);
      }
    }

    // 2. Segundo: buscar por nome (case-insensitive)
    if (!customerContact && order.customer_name) {
      const { data: contactByName } = await supabase
        .from('customer_contacts')
        .select('*')
        .ilike('customer_name', `%${order.customer_name}%`)
        .limit(1)
        .maybeSingle();
      
      if (contactByName) {
        customerContact = contactByName;
        contactSource = 'name';
        console.log('✅ Customer found by name:', contactByName.customer_name);
      }
    }

    // 3. Fallback: usar customer_whatsapp do próprio pedido
    if (!customerContact && order.customer_whatsapp) {
      customerContact = {
        id: null,
        // ✨ Priorizar customer_contact_name se disponível
        customer_name: order.customer_contact_name || order.customer_name,
        email: null,
        whatsapp: order.customer_whatsapp,
        preferred_channel: 'whatsapp',
        opt_in_whatsapp: true,
        opt_in_email: true,
      };
      contactSource = 'order_whatsapp';
      console.log('✅ Using customer_whatsapp from order:', order.customer_whatsapp, '- Contact name:', order.customer_contact_name || order.customer_name);
    }

    // Se não encontrou nenhum contato
    if (!customerContact) {
      console.log('⚠️ No customer contact found for:', order.customer_name);
      customerContact = {
        id: null,
        customer_name: order.customer_name,
        email: null,
        whatsapp: null,
        preferred_channel: 'whatsapp',
        opt_in_whatsapp: true,
        opt_in_email: true,
      };
      contactSource = 'none';
    }

    // Verificar opt-in
    const channels = payload.channel === 'both' 
      ? ['whatsapp', 'email'] 
      : payload.channel 
        ? [payload.channel] 
        : ['whatsapp'];

    const results = [];
    
    // 🧪 MODO TESTE: Enviar cópia para número de teste
    const testPhone = agentConfig.test_phone;
    const recipientsToNotify = [];
    
    // Adicionar destinatário principal (apenas se tiver WhatsApp)
    if (customerContact.whatsapp) {
      recipientsToNotify.push({
        phone: customerContact.whatsapp,
        name: customerContact.customer_name,
        isTest: false
      });
    }
    
    // ✅ IMPORTANTE: Número de teste SEMPRE recebe cópia (mesmo sem cliente)
    if (testPhone) {
      recipientsToNotify.push({
        phone: testPhone,
        name: `[TESTE] ${order.customer_name}`,
        isTest: true
      });
      console.log('🧪 Test mode active - will send to test phone:', testPhone);
    }
    
    // ⚠️ Se não há nenhum destinatário, logar e retornar
    if (recipientsToNotify.length === 0) {
      console.log('❌ No recipients to notify - no customer whatsapp and no test phone configured');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No recipients available - configure customer whatsapp or test phone',
        contactSource
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const channel of channels) {
      if (channel === 'whatsapp' && !agentConfig.whatsapp_enabled) continue;
      if (channel === 'email' && !agentConfig.email_enabled) continue;

      // Preparar contexto para mensagem humanizada
      const statusLabel = translateStatus(payload.new_status || order.status);
      const deliveryDate = order.delivery_date 
        ? new Date(order.delivery_date).toLocaleDateString('pt-BR') 
        : 'A definir';
      
      // Contar itens
      const itemsCount = order.order_items?.length || 0;
      const customerFirstName = customerContact.customer_name?.split(' ')[0] || 'Cliente';

      // Gerar mensagem humanizada via LLM
      const messageContent = payload.custom_message || await generateHumanizedMessage(
        customerFirstName,
        order.order_number,
        statusLabel,
        deliveryDate,
        order.carrier_name,
        order.tracking_code,
        itemsCount,
        agentConfig.signature || 'Equipe Imply',
        agentConfig
      );

      // Enviar para cada destinatário
      for (const recipient of recipientsToNotify) {
        if (channel === 'whatsapp' && !recipient.phone) continue;

        try {
          // Registrar no log
          const { data: logEntry } = await supabase
            .from('ai_notification_log')
            .insert({
              order_id: order.id,
              customer_contact_id: customerContact?.id,
              channel,
              recipient: recipient.phone,
              message_content: recipient.isTest 
                ? `[TESTE - Cliente: ${order.customer_name}]\n\n${messageContent}`
                : messageContent,
              status: 'pending',
              metadata: { 
                trigger_type: payload.trigger_type,
                contact_source: contactSource,
                is_test: recipient.isTest,
                new_status: payload.new_status
              },
            })
            .select()
            .single();

          if (channel === 'whatsapp') {
            const finalMessage = recipient.isTest 
              ? `🧪 *[MODO TESTE]*\n👤 Cliente: ${order.customer_name}\n📱 Tel: ${customerContact.whatsapp || 'N/A'}\n\n${messageContent}`
              : messageContent;
            
            const externalMessageId = await sendWhatsAppMessage(supabase, recipient.phone, finalMessage, logEntry.id);
            
            // Registrar na tabela de conversas
            if (!recipient.isTest) {
              await registerConversation(supabase, order, recipient.phone, messageContent, externalMessageId);
            }
            
            results.push({ 
              channel, 
              status: 'sent', 
              recipient: recipient.phone,
              isTest: recipient.isTest 
            });
          }
        } catch (sendError: any) {
          console.error(`❌ Error sending ${channel} to ${recipient.phone}:`, sendError);
          results.push({ 
            channel, 
            status: 'failed', 
            recipient: recipient.phone,
            error: sendError?.message 
          });
        }
      }
    }

    console.log('📊 Notification results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      contactSource
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ AI Agent Notify Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Emoji por status
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'almox_ssm_pending': '📥',
    'almox_ssm_received': '📥',
    'almox_ssm_approved': '✅',
    'order_generated': '📝',
    'separation_started': '🔧',
    'in_production': '⚙️',
    'awaiting_material': '⏳',
    'production_completed': '✅',
    'in_packaging': '📦',
    'ready_for_shipping': '📦',
    'awaiting_pickup': '🚚',
    'pickup_scheduled': '📅',
    'in_transit': '🚚',
    'collected': '🚚',
    'delivered': '✅',
    'completed': '🎉',
    'delayed': '⚠️',
    // Faturamento
    'ready_to_invoice': '📋',
    'pending_invoice_request': '📋',
    'invoice_requested': '🧾',
    'awaiting_invoice': '📄',
    'invoice_issued': '✅',
    'invoice_sent': '📤',
  };
  return emojis[status] || '📍';
}

// Traduzir status para português
function translateStatus(status: string): string {
  const labels: Record<string, string> = {
    'almox_ssm_pending': 'Recebido no Almox SSM',
    'almox_ssm_received': 'Recebido no Almoxarifado',
    'almox_ssm_approved': 'Aprovado pelo Almox',
    'order_generated': 'Ordem Gerada',
    'separation_started': 'Separação Iniciada',
    'in_production': 'Em Produção',
    'awaiting_material': 'Aguardando Material',
    'separation_completed': 'Separação Concluída',
    'production_completed': 'Produção Concluída',
    'in_packaging': 'Em Embalagem',
    'ready_for_shipping': 'Pronto para Envio',
    'awaiting_pickup': 'Aguardando Coleta',
    'pickup_scheduled': 'Coleta Agendada',
    'in_transit': 'Em Trânsito',
    'collected': 'Coletado',
    'delivered': 'Entregue',
    'completed': 'Concluído',
    'delayed': 'Atrasado',
    // Faturamento
    'ready_to_invoice': 'Pronto para Faturar',
    'pending_invoice_request': 'Aguardando Solicitação de Faturamento',
    'invoice_requested': 'Faturamento Solicitado',
    'awaiting_invoice': 'Aguardando Nota Fiscal',
    'invoice_issued': 'Nota Fiscal Emitida',
    'invoice_sent': 'Nota Fiscal Enviada',
  };
  return labels[status] || status;
}

// Mapeamento de status para fases
const STATUS_PHASE_MAP: Record<string, string[]> = {
  order_created: ['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_approved', 'order_generated'],
  in_production: ['separation_started', 'in_production', 'awaiting_material'],
  production_completed: ['production_completed', 'separation_completed'],
  ready_for_shipping: ['in_packaging', 'ready_for_shipping', 'awaiting_pickup', 'pickup_scheduled'],
  in_transit: ['in_transit', 'collected'],
  delivered: ['delivered', 'completed'],
  delayed: ['delayed'],
  // Fases de faturamento
  ready_to_invoice: ['ready_to_invoice', 'pending_invoice_request'],
  invoicing: ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'],
};

// Gerar mensagem humanizada usando LLM
async function generateHumanizedMessage(
  customerName: string,
  orderNumber: string,
  status: string,
  deliveryDate: string,
  carrierName: string | null,
  trackingCode: string | null,
  itemsCount: number,
  signature: string,
  agentConfig?: any
): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Get config options
  const useSignature = agentConfig?.use_signature ?? false;
  const closingStyle = agentConfig?.closing_style ?? 'varied';
  const conversationStyle = agentConfig?.conversation_style ?? 'chatty';
  const forbiddenPhrases = agentConfig?.forbidden_phrases ?? [
    'Qualquer dúvida, estou à disposição',
    'Fico no aguardo',
    'Abraço, Equipe Imply',
    'Equipe Imply',
    'Atenciosamente'
  ];
  
  if (!openaiApiKey) {
    // Fallback para template básico humanizado SEM assinatura repetitiva
    const closings = [
      'Me avisa se precisar de algo! 😊',
      'Qualquer coisa, só chamar!',
      'Tô por aqui se precisar! ✨',
      'Conta comigo!',
      ''
    ];
    const randomClosing = closings[Math.floor(Math.random() * closings.length)];
    
    return `Oi, ${customerName}! 😊

Olha só, tenho novidades do seu pedido *#${orderNumber}*!

${status}${deliveryDate !== 'A definir' ? ` - previsão de entrega ${deliveryDate}` : ''}.
${carrierName ? `Transportadora: ${carrierName}` : ''}
${trackingCode ? `Rastreio: ${trackingCode}` : ''}

${randomClosing}`.trim();
  }

  const forbiddenPhrasesText = forbiddenPhrases.length > 0 
    ? `⛔ NUNCA USE ESTAS FRASES (são robóticas e repetitivas):
${forbiddenPhrases.map((p: string) => `- "${p}"`).join('\n')}`
    : '';

  const signatureInstruction = useSignature 
    ? `Termine com assinatura: _${signature}_`
    : 'NÃO inclua assinatura formal no final';

  const closingInstruction = closingStyle === 'varied'
    ? `✅ VARIE o fechamento a cada mensagem. Exemplos:
- "Me avisa se precisar de algo!"
- "Tô por aqui se quiser saber algo!"
- "Qualquer coisa, só chamar!"
- "Conta comigo!"
- (às vezes nem precisa fechar, só a informação já basta)`
    : closingStyle === 'none'
    ? 'NÃO inclua fechamento ou despedida'
    : `Use sempre o mesmo fechamento: "Me avisa se precisar!"`;

  const styleInstruction = conversationStyle === 'chatty'
    ? `Escreva como conversa com amigo - natural, fluído, com expressões como "Olha só", "Sabe o que é", "Hmm"`
    : conversationStyle === 'concise'
    ? `Seja direto e conciso, mas ainda amigável`
    : `Mantenha tom profissional mas cordial`;

  const humanizedPrompt = `Você é um assistente humanizado da IMPLY Tecnologia. Gere uma mensagem de WhatsApp NATURAL e CONVERSACIONAL.

🎭 PERSONALIDADE:
- Você é uma PESSOA REAL conversando, NÃO um robô
- Use expressões naturais: "Olha só...", "Hmm", "Ah!", "Veja bem", "Sabe..."
- Demonstre empatia genuína
- VARIE suas saudações: "Oi!", "Olá!", "E aí!", "Fala!"

💬 ESTILO:
${styleInstruction}

📦 DADOS DO PEDIDO:
- Cliente: ${customerName}
- Pedido: #${orderNumber}
- Status: ${status}
- Entrega: ${deliveryDate}
${carrierName ? `- Transportadora: ${carrierName}` : ''}
${trackingCode ? `- Rastreio: ${trackingCode}` : ''}

${forbiddenPhrasesText}

${closingInstruction}
${signatureInstruction}

⚠️ REGRAS CRÍTICAS:
- NUNCA use formato de lista com emojis no início de cada linha
- NUNCA repita a mesma frase de fechamento que usou antes
- Use emojis com MODERAÇÃO (1-2 por mensagem)
- Mantenha entre 3-5 linhas CONVERSACIONAIS
- Seja ÚNICO a cada mensagem - varie expressões!

Gere APENAS a mensagem, sem explicações.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: humanizedPrompt },
          { role: 'user', content: `Gere uma mensagem humanizada para notificar ${customerName} sobre o pedido #${orderNumber} que está em "${status}".` }
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error('❌ OpenAI API error in notification:', response.status);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content;
    
    if (generatedMessage) {
      console.log('✅ Generated humanized message');
      return generatedMessage;
    }
    
    throw new Error('No message generated');
  } catch (error) {
    console.error('⚠️ Error generating humanized message, using fallback:', error);
    // Fallback humanizado SEM assinatura repetitiva
    const closings = [
      'Me avisa se precisar! 😊',
      'Tô aqui se quiser saber mais!',
      'Qualquer coisa, chama!',
      ''
    ];
    const randomClosing = closings[Math.floor(Math.random() * closings.length)];
    
    return `Oi, ${customerName}! 😊

Tenho novidades do seu pedido *#${orderNumber}*!

${status}${deliveryDate !== 'A definir' ? ` - previsão ${deliveryDate}` : ''}.
${carrierName ? `Vai com ${carrierName}` : ''}
${trackingCode ? `Rastreio: ${trackingCode}` : ''}

${randomClosing}`.trim();
  }
}

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
    await supabase
      .from('carrier_conversations')
      .insert({
        carrier_id: order.id,
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
          notification_type: 'status_change',
        },
      });
    console.log('✅ Conversation registered');
  } catch (error) {
    console.error('⚠️ Error registering conversation:', error);
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
    await supabase.from('ai_notification_log').update({ 
      status: 'failed',
      error_message: 'No connected WhatsApp instance'
    }).eq('id', logId);
    throw new Error('No connected WhatsApp instance');
  }

  const megaApiUrl = Deno.env.get('MEGA_API_URL');
  const megaApiToken = Deno.env.get('MEGA_API_TOKEN');

  if (!megaApiUrl || !megaApiToken) {
    await supabase.from('ai_notification_log').update({ 
      status: 'failed',
      error_message: 'Mega API not configured'
    }).eq('id', logId);
    throw new Error('Mega API not configured');
  }

  // Normalizar URL
  let baseUrl = megaApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  // Formatar número (remover caracteres não numéricos e adicionar 55 se necessário)
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  // ✅ ENDPOINT CORRETO: /rest/sendMessage/{instance}/text
  const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
  const fullUrl = `${baseUrl}${endpoint}`;

  // ✅ BODY CORRETO: messageData com to, text, linkPreview
  const body = {
    messageData: {
      to: formattedPhone,
      text: message,
      linkPreview: false,
    }
  };

  console.log(`📱 Sending WhatsApp to: ${formattedPhone} via ${fullUrl}`);

  // Multi-header fallback para compatibilidade com diferentes versões da API
  const authFormats: Array<Record<string, string>> = [
    { 'apikey': megaApiToken },
    { 'Authorization': `Bearer ${megaApiToken}` },
    { 'Apikey': megaApiToken },
  ];

  let megaData: any = null;
  let lastError = '';

  for (const authHeader of authFormats) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader,
      };

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log(`Response (${Object.keys(authHeader)[0]}):`, response.status, responseText.substring(0, 300));

      if (response.ok) {
        try {
          megaData = JSON.parse(responseText);
        } catch {
          megaData = { raw: responseText };
        }
        break;
      } else if (response.status === 401 || response.status === 403) {
        lastError = `Auth failed (${response.status}): ${responseText.substring(0, 200)}`;
        continue;
      } else {
        lastError = `Mega API error: ${response.status} - ${responseText.substring(0, 200)}`;
        break;
      }
    } catch (fetchError) {
      lastError = `Fetch error: ${fetchError}`;
      console.error('Fetch error:', fetchError);
    }
  }

  if (!megaData) {
    await supabase.from('ai_notification_log').update({ 
      status: 'failed',
      error_message: lastError
    }).eq('id', logId);
    throw new Error(lastError);
  }

  const externalMessageId = megaData.id || megaData.key?.id || megaData.messageId || null;
  
  // Atualizar log com sucesso
  await supabase
    .from('ai_notification_log')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      external_message_id: externalMessageId,
    })
    .eq('id', logId);

  console.log('✅ WhatsApp sent successfully, messageId:', externalMessageId);

  return externalMessageId;
}
