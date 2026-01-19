import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: process-delivery-response
 * 
 * Processa respostas de clientes sobre confirmação de entrega.
 * Chamada pelo webhook quando detecta resposta "sim" ou "não".
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      sender_phone, 
      message_content,
      conversation_id 
    } = await req.json();

    console.log('📩 Processing delivery response');
    console.log('📞 From:', sender_phone);
    console.log('💬 Message:', message_content);

    // Normalizar telefone para busca
    const phoneClean = sender_phone.replace(/\D/g, '');
    const lastDigits = phoneClean.slice(-8);

    // Buscar confirmação pendente mais recente para este telefone
    const { data: confirmations, error } = await supabase
      .from('delivery_confirmations')
      .select(`
        *,
        orders:order_id (
          id,
          order_number,
          status,
          organization_id
        )
      `)
      .eq('response_received', false)
      .or(`customer_whatsapp.ilike.%${lastDigits}%`)
      .order('sent_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching confirmations:', error);
      throw error;
    }

    if (!confirmations || confirmations.length === 0) {
      console.log('ℹ️ No pending confirmation found for this phone');
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'no_pending_confirmation' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const confirmation = confirmations[0];
    const order = confirmation.orders;
    const messageLower = message_content.toLowerCase().trim();

    console.log(`📦 Found pending confirmation for order: ${order?.order_number}`);

    // Detectar resposta
    let responseType: 'confirmed' | 'not_received' | 'invalid_response' = 'invalid_response';
    let replyMessage = '';

    // Padrões para "SIM" (entrega confirmada)
    const confirmPatterns = [
      /^sim$/i,
      /^s$/i,
      /^yes$/i,
      /^y$/i,
      /^recebi$/i,
      /^recebido$/i,
      /^chegou$/i,
      /^entregue$/i,
      /^ok$/i,
      /^✅$/,
      /^👍$/,
    ];

    // Padrões para "NÃO" (não recebeu)
    const notReceivedPatterns = [
      /^n[aã]o$/i,
      /^n$/i,
      /^no$/i,
      /^nao recebi$/i,
      /^não recebi$/i,
      /^n[aã]o chegou$/i,
      /^ainda n[aã]o$/i,
      /^❌$/,
      /^👎$/,
    ];

    // Verificar padrões
    for (const pattern of confirmPatterns) {
      if (pattern.test(messageLower)) {
        responseType = 'confirmed';
        break;
      }
    }

    if (responseType === 'invalid_response') {
      for (const pattern of notReceivedPatterns) {
        if (pattern.test(messageLower)) {
          responseType = 'not_received';
          break;
        }
      }
    }

    console.log(`🔍 Response type detected: ${responseType}`);

    // Buscar configuração para ações automáticas
    const { data: config } = await supabase
      .from('delivery_confirmation_config')
      .select('*')
      .eq('organization_id', order.organization_id)
      .single();

    // Atualizar confirmação
    const updateData: any = {
      response_received: true,
      response_type: responseType,
      response_text: message_content,
      responded_at: new Date().toISOString(),
      conversation_id: conversation_id
    };

    if (responseType === 'confirmed') {
      replyMessage = `✅ Obrigado pela confirmação!\n\nFicamos felizes que seu pedido *#${order.order_number}* chegou com sucesso. 😊\n\nQualquer dúvida, estamos à disposição!`;

      // Auto-completar pedido se configurado
      if (config?.auto_complete_on_confirm && order.status !== 'completed') {
        console.log('🔄 Auto-completing order');
        await supabase
          .from('orders')
          .update({ 
            status: 'completed',
            status_updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // Registrar no histórico
        await supabase
          .from('order_history')
          .insert({
            order_id: order.id,
            old_status: order.status,
            new_status: 'completed',
            changed_by: null,
            change_reason: 'Confirmação de entrega pelo cliente via WhatsApp'
          });
      }

    } else if (responseType === 'not_received') {
      updateData.requires_analysis = true;
      
      replyMessage = `📋 Entendido! Lamentamos que você ainda não tenha recebido seu pedido *#${order.order_number}*.\n\n🔍 Estamos abrindo uma análise interna e nossa equipe entrará em contato em breve para resolver essa situação.\n\nAgradecemos sua paciência! 🙏`;

      // Criar registro de análise se configurado
      if (config?.auto_create_analysis_on_not_received) {
        console.log('📋 Creating analysis record');
        updateData.analysis_notes = `Cliente reportou não recebimento em ${new Date().toLocaleString('pt-BR')}. Mensagem original: "${message_content}"`;
      }

    } else {
      // Resposta inválida - enviar instruções
      replyMessage = `❓ Desculpe, não entendi sua resposta.\n\nPor favor, responda:\n✅ *SIM* - Se recebeu o pedido\n❌ *NÃO* - Se ainda não recebeu\n\nPedido: *#${order.order_number}*`;
      
      // Não marcar como respondido para respostas inválidas
      updateData.response_received = false;
      updateData.response_type = null;
    }

    // Atualizar confirmação no banco
    await supabase
      .from('delivery_confirmations')
      .update(updateData)
      .eq('id', confirmation.id);

    // Enviar resposta ao cliente
    if (replyMessage) {
      await sendReplyMessage(supabase, sender_phone, replyMessage);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      response_type: responseType,
      order_number: order.order_number,
      reply_sent: !!replyMessage
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

async function sendReplyMessage(supabase: any, phone: string, message: string): Promise<boolean> {
  const megaApiUrl = Deno.env.get('MEGA_API_URL');
  const megaApiToken = Deno.env.get('MEGA_API_TOKEN');

  if (!megaApiUrl || !megaApiToken) {
    console.error('❌ Mega API not configured');
    return false;
  }

  // Buscar instância conectada
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_key, api_token')
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();

  if (!instance) {
    console.error('❌ No connected WhatsApp instance');
    return false;
  }

  const token = instance.api_token || megaApiToken;

  // Normalizar telefone
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  // Construir URL
  let baseUrl = megaApiUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
  const sendUrl = `${baseUrl}${endpoint}`;

  const body = {
    messageData: {
      to: formattedPhone,
      text: message,
      linkPreview: false
    }
  };

  console.log(`📤 Sending reply to ${formattedPhone}`);

  try {
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      console.log('✅ Reply sent successfully');
      return true;
    }

    const errorText = await response.text();
    console.error(`❌ Failed: ${response.status} - ${errorText.substring(0, 100)}`);
    return false;

  } catch (err) {
    console.error('❌ Error sending reply:', err);
    return false;
  }
}
