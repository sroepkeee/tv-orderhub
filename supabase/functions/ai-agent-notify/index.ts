import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  order_id?: string;
  trigger_type?: 'status_change' | 'deadline' | 'manual' | 'order_created';
  new_status?: string;
  custom_message?: string;
  channel?: 'whatsapp' | 'email' | 'both';
  // Para reenvio
  action?: 'resend';
  notificationId?: string;
}

// =====================================================
// 📋 FUNÇÕES AUXILIARES
// =====================================================

function normalizePhoneCanonical(phone: string): string {
  if (!phone) return phone;
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }
  
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(5);
    digits = '55' + ddd + numero;
  }
  
  return digits;
}

function normalizeStatus(status: string): string {
  const s = (status || '').trim().toLowerCase();
  const map: Record<string, string> = {
    'concluido': 'completed',
    'concluído': 'completed',
    'entregue': 'delivered',
  };
  return map[s] || s;
}

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
    'ready_to_invoice': '📋',
    'pending_invoice_request': '📋',
    'invoice_requested': '🧾',
    'awaiting_invoice': '📄',
    'invoice_issued': '✅',
    'invoice_sent': '📤',
  };
  return emojis[status] || '📍';
}

function getProgressBar(status: string): string {
  const statusToProgress: Record<string, number> = {
    'almox_ssm_pending': 20,
    'almox_ssm_received': 20,
    'almox_ssm_approved': 20,
    'order_generated': 20,
    'separation_started': 40,
    'in_production': 40,
    'awaiting_material': 40,
    'production_completed': 40,
    'separation_completed': 40,
    'in_packaging': 60,
    'ready_for_shipping': 60,
    'ready_to_invoice': 60,
    'invoice_requested': 60,
    'invoice_issued': 60,
    'awaiting_pickup': 80,
    'pickup_scheduled': 80,
    'in_transit': 80,
    'collected': 80,
    'delivered': 100,
    'completed': 100,
  };
  
  const progress = statusToProgress[status] || 0;
  return `${progress}%`;
}

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
    'ready_to_invoice': 'Pronto para Faturar',
    'pending_invoice_request': 'Aguardando Solicitação de Faturamento',
    'invoice_requested': 'Faturamento Solicitado',
    'awaiting_invoice': 'Aguardando Nota Fiscal',
    'invoice_issued': 'Nota Fiscal Emitida',
    'invoice_sent': 'Nota Fiscal Enviada',
  };
  return labels[status] || status;
}

const STATUS_PHASE_MAP: Record<string, string[]> = {
  order_created: ['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_approved', 'order_generated'],
  in_production: ['separation_started', 'in_production', 'awaiting_material'],
  production_completed: ['production_completed', 'separation_completed'],
  ready_for_shipping: ['in_packaging', 'ready_for_shipping', 'awaiting_pickup', 'pickup_scheduled'],
  in_transit: ['in_transit', 'collected'],
  delivered: ['delivered', 'completed'],
  delayed: ['delayed'],
  ready_to_invoice: ['ready_to_invoice', 'pending_invoice_request'],
  invoicing: ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'],
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

function formatVisualMessage(
  customerName: string,
  orderNumber: string,
  status: string,
  statusLabel: string,
  deliveryDate: string,
  carrierName: string | null,
  trackingCode: string | null,
  progressBar: string,
  statusEmoji: string
): string {
  const isFinalStatus = ['delivered', 'completed'].includes(status);
  
  const greetings = [
    `Oi, ${customerName}! 😊`,
    `Olá, ${customerName}! 👋`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  let dateLine = '';
  if (isFinalStatus) {
    dateLine = deliveryDate && deliveryDate !== 'A definir' 
      ? `📅 *Entregue em:* ${deliveryDate}` 
      : '';
  } else {
    dateLine = deliveryDate && deliveryDate !== 'A definir' 
      ? `📅 *Previsão:* ${deliveryDate}` 
      : '';
  }
  
  const mainMessage = isFinalStatus
    ? `Seu pedido *#${orderNumber}* foi concluído com sucesso! ✅`
    : `Seu pedido *#${orderNumber}* avançou! 🎉`;
  
  const progressLine = isFinalStatus ? '' : `📊 *Progresso:* ${progressBar}`;
  
  const carrierLine = carrierName ? `🚚 *Transportadora:* ${carrierName}` : '';
  const trackingLine = trackingCode ? `📋 *Rastreio:* ${trackingCode}` : '';
  
  const infoLines = [
    `${statusEmoji} *Status:* ${statusLabel}`,
    dateLine,
    carrierLine,
    trackingLine,
    progressLine
  ].filter(line => line).join('\n');

  const closing = isFinalStatus
    ? 'Obrigado pela preferência! 🙏'
    : 'Me avisa se precisar de algo! ✨';

  return `📦 *Atualização do seu Pedido*

${greeting}

${mainMessage}

${infoLines}

${closing}`.trim();
}

// =====================================================
// 🚀 HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationRequest = await req.json();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📬 AI Agent Notify - QUEUE MODE');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 🔄 Handler para reenvio de notificação - também vai para fila
    if (payload.action === 'resend' && payload.notificationId) {
      console.log('🔄 Resending notification:', payload.notificationId);
      
      const { data: notification, error: notifError } = await supabase
        .from('ai_notification_log')
        .select('*')
        .eq('id', payload.notificationId)
        .single();

      if (notifError || !notification) {
        throw new Error('Notification not found: ' + (notifError?.message || 'Unknown error'));
      }

      if (notification.channel === 'whatsapp') {
        // Enfileirar reenvio
        const { data: queueEntry, error: queueError } = await supabase
          .from('message_queue')
          .insert({
            recipient_whatsapp: notification.recipient,
            recipient_name: null,
            message_type: 'notification_resend',
            message_content: notification.message_content,
            priority: 1, // Alta prioridade para reenvio manual
            status: 'pending',
            scheduled_for: new Date().toISOString(), // Imediato
            attempts: 0,
            max_attempts: 3,
            metadata: {
              source: 'ai-agent-notify',
              action: 'resend',
              original_notification_id: notification.id,
              order_id: notification.order_id,
              queued_at: new Date().toISOString(),
            },
          })
          .select('id')
          .single();

        if (queueError) {
          throw new Error('Failed to queue resend: ' + queueError.message);
        }

        // Atualizar log original
        await supabase
          .from('ai_notification_log')
          .update({ 
            status: 'queued',
            metadata: {
              ...notification.metadata,
              resend_queue_id: queueEntry.id,
              resend_at: new Date().toISOString(),
            }
          })
          .eq('id', notification.id);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Notification queued for resend',
          queueId: queueEntry.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

    // Buscar pedido
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('id', payload.order_id)
      .single();

    if (!order) {
      throw new Error('Order not found');
    }

    console.log('📦 Order found:', order.order_number, 'Customer:', order.customer_name);

    // 🔍 BUSCA DO CLIENTE
    let customerContact = null;
    let contactSource = '';

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
      }
    }

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
      }
    }

    if (!customerContact && order.customer_whatsapp) {
      customerContact = {
        id: null,
        customer_name: order.customer_contact_name || order.customer_name,
        email: null,
        whatsapp: order.customer_whatsapp,
        preferred_channel: 'whatsapp',
        opt_in_whatsapp: true,
        opt_in_email: true,
      };
      contactSource = 'order_whatsapp';
    }

    if (!customerContact) {
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

    // 🧪 MODO TESTE/PRODUÇÃO
    const testModeEnabled = agentConfig.test_mode_enabled ?? true;
    const testPhones = agentConfig.test_phones || 
      (agentConfig.test_phone ? [agentConfig.test_phone] : []);
    const recipientsToNotify: Array<{ phone: string; name: string; isTest: boolean }> = [];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 RECIPIENT DIAGNOSIS');
    console.log('🎯 MODE:', testModeEnabled ? '🧪 TESTE' : '🚀 PRODUÇÃO');
    console.log('📦 Order:', order.order_number);
    console.log('👤 Customer Name:', order.customer_name);
    console.log('📱 Order customer_whatsapp:', order.customer_whatsapp || 'N/A');
    console.log('🔍 Contact Source:', contactSource);
    console.log('📞 Contact WhatsApp:', customerContact.whatsapp || 'N/A');
    console.log('🧪 Test Phones:', testPhones.length > 0 ? testPhones.join(', ') : 'NONE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (testModeEnabled) {
      for (const testPhone of testPhones) {
        if (testPhone) {
          recipientsToNotify.push({
            phone: testPhone,
            name: `[TESTE] ${order.customer_name}`,
            isTest: true
          });
        }
      }
    } else {
      if (customerContact.whatsapp) {
        recipientsToNotify.push({
          phone: customerContact.whatsapp,
          name: customerContact.customer_name,
          isTest: false
        });
      }
      
      for (const testPhone of testPhones) {
        if (testPhone) {
          recipientsToNotify.push({
            phone: testPhone,
            name: `[CÓPIA] ${order.customer_name}`,
            isTest: true
          });
        }
      }
    }
    
    console.log('📊 TOTAL RECIPIENTS:', recipientsToNotify.length);
    
    if (recipientsToNotify.length === 0) {
      const errorMessage = testModeEnabled 
        ? 'No test phones configured'
        : 'No customer WhatsApp available';
      
      return new Response(JSON.stringify({ 
        success: false, 
        message: errorMessage,
        mode: testModeEnabled ? 'test' : 'production',
        contactSource,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar mensagem
    const rawStatus = payload.new_status || order.status;
    const status = normalizeStatus(rawStatus);
    const deliveryDate = order.delivery_date 
      ? new Date(order.delivery_date).toLocaleDateString('pt-BR') 
      : 'A definir';
    
    const customerFirstName = customerContact.customer_name?.split(' ')[0] || 'Cliente';
    const capitalizedFirstName = customerFirstName.charAt(0).toUpperCase() + 
      customerFirstName.slice(1).toLowerCase();

    const statusLabel = translateStatus(status);
    const statusEmoji = getStatusEmoji(status);
    const progressBar = getProgressBar(status);

    const messageContent = payload.custom_message || formatVisualMessage(
      capitalizedFirstName,
      order.order_number,
      status,
      statusLabel,
      deliveryDate,
      order.carrier_name,
      order.tracking_code,
      progressBar,
      statusEmoji
    );

    // 📬 ENFILEIRAR TODAS AS MENSAGENS
    const results: Array<{ recipient: string; status: string; queueId?: string; logId?: string; error?: string }> = [];
    let baseDelay = 0;

    for (const recipient of recipientsToNotify) {
      const normalizedPhone = normalizePhoneCanonical(recipient.phone);
      
      const finalMessage = recipient.isTest 
        ? `[MODO TESTE]\n👤 ${order.customer_name}\n📱 ${customerContact.whatsapp || 'N/A'}\n\n${messageContent}`
        : messageContent;

      // 1. Criar log de notificação
      const { data: logEntry, error: logError } = await supabase
        .from('ai_notification_log')
        .insert({
          order_id: order.id,
          customer_contact_id: customerContact?.id,
          channel: 'whatsapp',
          recipient: normalizedPhone,
          message_content: finalMessage,
          status: 'queued',
          metadata: { 
            trigger_type: payload.trigger_type,
            contact_source: contactSource,
            is_test: recipient.isTest,
            new_status: payload.new_status,
            source: 'ai-agent-notify',
          },
        })
        .select('id')
        .single();

      if (logError) {
        console.error('❌ Error creating log:', logError);
        results.push({ recipient: recipient.phone, status: 'failed', error: logError.message });
        continue;
      }

      // 2. Enfileirar mensagem com escalonamento de tempo
      const scheduledFor = new Date(Date.now() + baseDelay).toISOString();

      const { data: queueEntry, error: queueError } = await supabase
        .from('message_queue')
        .insert({
          recipient_whatsapp: normalizedPhone,
          recipient_name: recipient.name,
          message_type: payload.trigger_type === 'order_created' ? 'order_created' : 'status_change',
          message_content: finalMessage,
          priority: 2, // Prioridade alta para notificações de cliente
          status: 'pending',
          scheduled_for: scheduledFor,
          attempts: 0,
          max_attempts: 3,
          metadata: {
            source: 'ai-agent-notify',
            notification_log_id: logEntry.id,
            order_id: order.id,
            order_number: order.order_number,
            trigger_type: payload.trigger_type,
            is_test: recipient.isTest,
            new_status: payload.new_status,
            queued_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (queueError) {
        console.error('❌ Error queuing message:', queueError);
        
        await supabase
          .from('ai_notification_log')
          .update({ status: 'failed', error_message: queueError.message })
          .eq('id', logEntry.id);
        
        results.push({ recipient: recipient.phone, status: 'failed', logId: logEntry.id, error: queueError.message });
        continue;
      }

      // 3. Atualizar log com referência à fila
      await supabase
        .from('ai_notification_log')
        .update({ 
          metadata: {
            trigger_type: payload.trigger_type,
            contact_source: contactSource,
            is_test: recipient.isTest,
            new_status: payload.new_status,
            source: 'ai-agent-notify',
            queue_id: queueEntry.id,
          }
        })
        .eq('id', logEntry.id);

      results.push({ 
        recipient: recipient.phone, 
        status: 'queued', 
        queueId: queueEntry.id,
        logId: logEntry.id,
      });

      console.log(`✅ Queued notification for ${recipient.phone} (queue: ${queueEntry.id})`);

      // Escalonar próxima mensagem com delay de 5-10s
      baseDelay += 5000 + Math.random() * 5000;
    }

    // 📢 NOTIFICAR DISCORD sobre envio de notificações ao cliente
    try {
      const successfulQueued = results.filter(r => r.status === 'queued').length;
      if (successfulQueued > 0) {
        await supabase.functions.invoke('discord-notify', {
          body: {
            notificationType: 'ai_customer_notification',
            priority: 3,
            title: `📱 Notificação Enviada: #${order.order_number}`,
            message: `**Cliente:** ${order.customer_name}\n**Status:** ${translateStatus(rawStatus)}\n**Modo:** ${testModeEnabled ? '🧪 Teste' : '🚀 Produção'}\n**Destinatários:** ${successfulQueued}`,
            orderId: order.id,
            orderNumber: order.order_number,
            organizationId: order.organization_id,
            metadata: {
              trigger_type: payload.trigger_type,
              new_status: payload.new_status,
              is_test: testModeEnabled,
            }
          }
        });
        console.log('📢 Discord notified about customer notification');
      }
    } catch (discordErr) {
      console.warn('⚠️ Failed to notify Discord (non-blocking):', discordErr);
    }

    console.log('📊 Queue results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      queued: true,
      results,
      contactSource,
      mode: testModeEnabled ? 'test' : 'production',
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
