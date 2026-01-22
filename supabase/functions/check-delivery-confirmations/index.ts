import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeliveryConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  trigger_after_hours: number;
  trigger_status: string[];
  message_template: string;
  followup_enabled: boolean;
  followup_after_hours: number;
  followup_message_template: string;
  max_attempts: number;
  retry_interval_hours: number;
  auto_complete_on_confirm: boolean;
  auto_create_analysis_on_not_received: boolean;
}

interface ExistingConfirmation {
  order_id: string;
  response_received: boolean;
  attempts_count: number;
  last_attempt_at: string;
}

/**
 * Normaliza telefone para formato canônico brasileiro
 */
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

/**
 * Edge Function: check-delivery-confirmations
 * 
 * Agora ENFILEIRA mensagens ao invés de enviar diretamente.
 * O envio real é feito pelo process-message-queue.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Check Delivery Confirmations - QUEUE MODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // 1. Buscar todas as configurações ativas
    const { data: configs, error: configError } = await supabase
      .from('delivery_confirmation_config')
      .select('*')
      .eq('is_active', true);

    if (configError) {
      console.error('❌ Error fetching configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('ℹ️ No active delivery confirmation configs found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active configs',
        orders_processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${configs.length} active configs`);

    let totalProcessed = 0;
    let totalQueued = 0;

    // 2. Processar cada organização
    for (const config of configs as DeliveryConfig[]) {
      console.log(`\n🏢 Processing organization: ${config.organization_id}`);
      
      const result = await processOrganization(supabase, config);
      totalProcessed += result.processed;
      totalQueued += result.queued;

      // 📢 NOTIFICAR DISCORD sobre confirmações de entrega
      if (result.queued > 0) {
        try {
          await supabase.functions.invoke('discord-notify', {
            body: {
              notificationType: 'delivery_confirmation',
              priority: 3,
              title: '📦 Confirmações de Entrega',
              message: `**Pedidos processados:** ${result.processed}\n**Mensagens enfileiradas:** ${result.queued}\n**Organização:** ${config.organization_id.substring(0, 8)}...`,
              organizationId: config.organization_id,
              metadata: {
                processed: result.processed,
                queued: result.queued,
              }
            }
          });
          console.log('📢 Discord notified about delivery confirmations');
        } catch (discordErr) {
          console.warn('⚠️ Failed to notify Discord (non-blocking):', discordErr);
        }
      }
    }

    console.log(`\n✅ Completed: ${totalProcessed} orders processed, ${totalQueued} messages queued`);

    return new Response(JSON.stringify({ 
      success: true, 
      orders_processed: totalProcessed,
      messages_queued: totalQueued
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processOrganization(supabase: any, config: DeliveryConfig) {
  const { organization_id, trigger_after_hours, trigger_status, max_attempts, retry_interval_hours } = config;
  
  let processed = 0;
  let queued = 0;

  const triggerDate = new Date();
  triggerDate.setHours(triggerDate.getHours() - trigger_after_hours);

  console.log(`⏰ Looking for orders in transit since before: ${triggerDate.toISOString()}`);
  console.log(`📍 Trigger statuses: ${trigger_status.join(', ')}`);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      customer_whatsapp,
      status,
      status_updated_at,
      organization_id
    `)
    .eq('organization_id', organization_id)
    .in('status', trigger_status)
    .not('customer_whatsapp', 'is', null)
    .lte('status_updated_at', triggerDate.toISOString());

  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError);
    return { processed: 0, queued: 0 };
  }

  if (!orders || orders.length === 0) {
    console.log('ℹ️ No eligible orders found');
    return { processed: 0, queued: 0 };
  }

  console.log(`📦 Found ${orders.length} potential orders`);

  const orderIds = orders.map((o: any) => o.id);
  const { data: existingConfirmations } = await supabase
    .from('delivery_confirmations')
    .select('order_id, response_received, attempts_count, last_attempt_at')
    .in('order_id', orderIds);

  const confirmationMap = new Map<string, ExistingConfirmation>(
    (existingConfirmations || []).map((c: ExistingConfirmation) => [c.order_id, c])
  );

  // Buscar nome da empresa
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organization_id)
    .single();

  const companyName = org?.name || 'Nossa Empresa';

  // Base delay para escalonamento
  let baseDelay = 0;

  for (const order of orders) {
    processed++;
    const existing = confirmationMap.get(order.id);

    if (existing) {
      if (existing.response_received) {
        console.log(`⏭️ Order ${order.order_number}: Already confirmed`);
        continue;
      }

      if (existing.attempts_count >= max_attempts) {
        console.log(`⏭️ Order ${order.order_number}: Max attempts reached (${existing.attempts_count})`);
        continue;
      }

      const lastAttempt = new Date(existing.last_attempt_at);
      const retryDate = new Date();
      retryDate.setHours(retryDate.getHours() - retry_interval_hours);
      
      if (lastAttempt > retryDate) {
        console.log(`⏭️ Order ${order.order_number}: Retry interval not reached`);
        continue;
      }

      if (config.followup_enabled) {
        console.log(`🔄 Order ${order.order_number}: Queuing follow-up (attempt ${existing.attempts_count + 1})`);
        
        const success = await queueConfirmationMessage(
          supabase, 
          order, 
          config.followup_message_template,
          companyName,
          true,
          baseDelay
        );
        
        if (success) {
          await supabase
            .from('delivery_confirmations')
            .update({
              attempts_count: existing.attempts_count + 1,
              last_attempt_at: new Date().toISOString()
            })
            .eq('order_id', order.id);
          
          queued++;
          baseDelay += 8000 + Math.random() * 4000; // 8-12s entre mensagens
        }
      }
    } else {
      console.log(`📤 Order ${order.order_number}: Queuing first confirmation request`);
      
      const success = await queueConfirmationMessage(
        supabase,
        order,
        config.message_template,
        companyName,
        false,
        baseDelay
      );

      if (success) {
        await supabase
          .from('delivery_confirmations')
          .insert({
            organization_id: order.organization_id,
            order_id: order.id,
            customer_whatsapp: order.customer_whatsapp,
            customer_name: order.customer_name,
            order_status: order.status,
            sent_at: new Date().toISOString(),
            attempts_count: 1,
            last_attempt_at: new Date().toISOString(),
            max_attempts: max_attempts
          });

        queued++;
        baseDelay += 8000 + Math.random() * 4000;
      }
    }
  }

  return { processed, queued };
}

async function queueConfirmationMessage(
  supabase: any,
  order: any,
  template: string,
  companyName: string,
  isFollowup: boolean,
  delayMs: number
): Promise<boolean> {
  try {
    // Substituir variáveis no template
    const message = template
      .replace(/\{\{empresa\}\}/g, companyName)
      .replace(/\{\{numero_pedido\}\}/g, order.order_number || order.id.substring(0, 8))
      .replace(/\{\{cliente\}\}/g, order.customer_name || 'Cliente');

    const normalizedPhone = normalizePhoneCanonical(order.customer_whatsapp);
    
    const scheduledFor = delayMs > 0 
      ? new Date(Date.now() + delayMs).toISOString() 
      : null;

    // 1. Registrar no log de notificações
    const { data: logEntry, error: logError } = await supabase
      .from('ai_notification_log')
      .insert({
        order_id: order.id,
        channel: 'whatsapp',
        recipient: normalizedPhone,
        message_content: message,
        status: 'queued',
        metadata: {
          type: 'delivery_confirmation',
          is_followup: isFollowup,
          order_number: order.order_number,
          source: 'check-delivery-confirmations',
        }
      })
      .select('id')
      .single();

    if (logError) {
      console.error('❌ Error creating log:', logError);
      return false;
    }

    // 2. Enfileirar mensagem
    const { data: queueEntry, error: queueError } = await supabase
      .from('message_queue')
      .insert({
        recipient_whatsapp: normalizedPhone,
        recipient_name: order.customer_name,
        message_type: isFollowup ? 'delivery_confirmation_followup' : 'delivery_confirmation',
        message_content: message,
        priority: 2, // Prioridade alta
        status: 'pending',
        scheduled_for: scheduledFor,
        attempts: 0,
        max_attempts: 3,
        metadata: {
          source: 'check-delivery-confirmations',
          notification_log_id: logEntry.id,
          order_id: order.id,
          order_number: order.order_number,
          is_followup: isFollowup,
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
      
      return false;
    }

    // 3. Atualizar log com referência à fila
    await supabase
      .from('ai_notification_log')
      .update({ 
        metadata: {
          type: 'delivery_confirmation',
          is_followup: isFollowup,
          order_number: order.order_number,
          source: 'check-delivery-confirmations',
          queue_id: queueEntry.id,
        }
      })
      .eq('id', logEntry.id);

    console.log(`✅ Message queued for order ${order.order_number} (queue: ${queueEntry.id})`);
    return true;

  } catch (error) {
    console.error('❌ Error in queueConfirmationMessage:', error);
    return false;
  }
}
