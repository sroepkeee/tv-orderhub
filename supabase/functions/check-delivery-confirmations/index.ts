import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

/**
 * Edge Function: check-delivery-confirmations
 * 
 * Esta função é executada via cron para:
 * 1. Encontrar pedidos em trânsito há X horas que ainda não receberam confirmação
 * 2. Enviar mensagem de confirmação de entrega via WhatsApp
 * 3. Rastrear respostas pendentes
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Check Delivery Confirmations - Starting');
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
    let totalSent = 0;

    // 2. Processar cada organização
    for (const config of configs as DeliveryConfig[]) {
      console.log(`\n🏢 Processing organization: ${config.organization_id}`);
      
      const result = await processOrganization(supabase, config);
      totalProcessed += result.processed;
      totalSent += result.sent;
    }

    console.log(`\n✅ Completed: ${totalProcessed} orders processed, ${totalSent} messages sent`);

    return new Response(JSON.stringify({ 
      success: true, 
      orders_processed: totalProcessed,
      messages_sent: totalSent
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

interface ExistingConfirmation {
  order_id: string;
  response_received: boolean;
  attempts_count: number;
  last_attempt_at: string;
}

async function processOrganization(supabase: any, config: DeliveryConfig) {
  const { organization_id, trigger_after_hours, trigger_status, max_attempts, retry_interval_hours } = config;
  
  let processed = 0;
  let sent = 0;

  // Calcular data limite (pedidos que entraram no status há X horas)
  const triggerDate = new Date();
  triggerDate.setHours(triggerDate.getHours() - trigger_after_hours);

  console.log(`⏰ Looking for orders in transit since before: ${triggerDate.toISOString()}`);
  console.log(`📍 Trigger statuses: ${trigger_status.join(', ')}`);

  // Buscar pedidos elegíveis
  // - Status em trigger_status
  // - Sem confirmação pendente OU com confirmação pendente para retry
  // - Com customer_whatsapp preenchido
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
    return { processed: 0, sent: 0 };
  }

  if (!orders || orders.length === 0) {
    console.log('ℹ️ No eligible orders found');
    return { processed: 0, sent: 0 };
  }

  console.log(`📦 Found ${orders.length} potential orders`);

  // Buscar confirmações existentes para estes pedidos
  const orderIds = orders.map((o: any) => o.id);
  const { data: existingConfirmations } = await supabase
    .from('delivery_confirmations')
    .select('order_id, response_received, attempts_count, last_attempt_at')
    .in('order_id', orderIds);

  const confirmationMap = new Map<string, ExistingConfirmation>(
    (existingConfirmations || []).map((c: ExistingConfirmation) => [c.order_id, c])
  );

  // Buscar instância WhatsApp conectada
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_key, api_token, status')
    .eq('status', 'connected')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!instance) {
    console.log('⚠️ No connected WhatsApp instance');
    return { processed: 0, sent: 0 };
  }

  // Buscar nome da empresa para a mensagem
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organization_id)
    .single();

  const companyName = org?.name || 'Nossa Empresa';

  // Processar cada pedido
  for (const order of orders) {
    processed++;
    const existing = confirmationMap.get(order.id);

    // Verificar se já existe confirmação
    if (existing) {
      // Já respondeu? Pular
      if (existing.response_received) {
        console.log(`⏭️ Order ${order.order_number}: Already confirmed`);
        continue;
      }

      // Verificar se já atingiu máximo de tentativas
      if (existing.attempts_count >= max_attempts) {
        console.log(`⏭️ Order ${order.order_number}: Max attempts reached (${existing.attempts_count})`);
        continue;
      }

      // Verificar intervalo entre tentativas
      const lastAttempt = new Date(existing.last_attempt_at);
      const retryDate = new Date();
      retryDate.setHours(retryDate.getHours() - retry_interval_hours);
      
      if (lastAttempt > retryDate) {
        console.log(`⏭️ Order ${order.order_number}: Retry interval not reached`);
        continue;
      }

      // Enviar follow-up
      if (config.followup_enabled) {
        console.log(`🔄 Order ${order.order_number}: Sending follow-up (attempt ${existing.attempts_count + 1})`);
        const success = await sendConfirmationMessage(
          supabase, 
          order, 
          config.followup_message_template,
          companyName,
          instance,
          true // is follow-up
        );
        
        if (success) {
          // Atualizar tentativas
          await supabase
            .from('delivery_confirmations')
            .update({
              attempts_count: existing.attempts_count + 1,
              last_attempt_at: new Date().toISOString()
            })
            .eq('order_id', order.id);
          
          sent++;
        }
      }
    } else {
      // Primeira mensagem de confirmação
      console.log(`📤 Order ${order.order_number}: Sending first confirmation request`);
      const success = await sendConfirmationMessage(
        supabase,
        order,
        config.message_template,
        companyName,
        instance,
        false
      );

      if (success) {
        // Criar registro de confirmação
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

        sent++;
      }
    }

    // Delay entre envios para não bloquear
    await delayMs(3000);
  }

  return { processed, sent };
}

async function sendConfirmationMessage(
  supabase: any,
  order: any,
  template: string,
  companyName: string,
  instance: any,
  isFollowup: boolean
): Promise<boolean> {
  const megaApiUrl = Deno.env.get('MEGA_API_URL');
  const megaApiToken = instance.api_token || Deno.env.get('MEGA_API_TOKEN');

  if (!megaApiUrl || !megaApiToken) {
    console.error('❌ Mega API not configured');
    return false;
  }

  // Substituir variáveis no template
  const message = template
    .replace(/\{\{empresa\}\}/g, companyName)
    .replace(/\{\{numero_pedido\}\}/g, order.order_number || order.id.substring(0, 8))
    .replace(/\{\{cliente\}\}/g, order.customer_name || 'Cliente');

  // Normalizar telefone
  let phone = order.customer_whatsapp.replace(/\D/g, '');
  if (!phone.startsWith('55')) {
    phone = '55' + phone;
  }
  // Garantir formato correto (sem 9 extra para landlines, com 9 para mobile)
  if (phone.length === 12) {
    // Pode ser fixo ou mobile sem 9
    const ddd = parseInt(phone.substring(2, 4));
    // DDDs que precisam do 9: todos os móveis
    if (ddd <= 28) {
      // Adicionar 9 para DDDs de celular
      phone = phone.substring(0, 4) + '9' + phone.substring(4);
    }
  }

  // Construir URL e body
  let baseUrl = megaApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
  const sendUrl = `${baseUrl}${endpoint}`;

  const body = {
    messageData: {
      to: phone,
      text: message,
      linkPreview: false
    }
  };

  console.log(`📤 Sending to ${phone}: ${message.substring(0, 50)}...`);

  // Tentar múltiplos headers de autenticação
  const authFormats = [
    { 'apikey': megaApiToken },
    { 'Authorization': `Bearer ${megaApiToken}` },
    { 'Apikey': megaApiToken },
  ];

  for (const authHeader of authFormats) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      Object.entries(authHeader).forEach(([key, value]) => {
        if (value) headers[key] = value;
      });

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        console.log(`✅ Message sent successfully to order ${order.order_number}`);
        
        // Registrar no log de notificações
        await supabase
          .from('ai_notification_log')
          .insert({
            order_id: order.id,
            channel: 'whatsapp',
            recipient: phone,
            message_content: message,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: {
              type: 'delivery_confirmation',
              is_followup: isFollowup,
              order_number: order.order_number
            }
          });

        return true;
      }

      if (response.status === 401 || response.status === 403) {
        continue; // Tentar próximo header
      }

      const errorText = await response.text();
      console.error(`❌ Failed: ${response.status} - ${errorText.substring(0, 100)}`);
      return false;

    } catch (err) {
      console.error('❌ Fetch error:', err);
      continue;
    }
  }

  console.error('❌ All auth methods failed');
  return false;
}
