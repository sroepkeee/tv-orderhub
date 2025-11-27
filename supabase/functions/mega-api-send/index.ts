import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  carrierId: string;
  orderId: string;
  message: string;
  conversationType: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se usuário está autorizado
    const { data: authData, error: authCheckError } = await supabase
      .from('whatsapp_authorized_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (authCheckError || !authData) {
      throw new Error('User not authorized to send WhatsApp messages');
    }

    const { carrierId, orderId, message, conversationType }: SendMessageRequest = await req.json();

    // Buscar dados da transportadora
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('id, name, whatsapp')
      .eq('id', carrierId)
      .single();

    if (carrierError || !carrier || !carrier.whatsapp) {
      throw new Error('Carrier not found or WhatsApp not configured');
    }

    // Formatar número de telefone (remover caracteres especiais)
    const phoneNumber = carrier.whatsapp.replace(/\D/g, '');

    // Buscar informações do pedido para contexto
    const { data: order } = await supabase
      .from('orders')
      .select('order_number, customer_name')
      .eq('id', orderId)
      .single();

    // Montar mensagem com contexto
    const fullMessage = order 
      ? `*Pedido ${order.order_number}* - ${order.customer_name}\n\n${message}`
      : message;

    // Enviar mensagem via Mega API
    const megaApiUrl = Deno.env.get('MEGA_API_URL') ?? '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') ?? '';

    console.log('Sending WhatsApp message:', {
      instance: megaApiInstance,
      phoneNumber,
      messagePreview: fullMessage.substring(0, 50)
    });

    const megaResponse = await fetch(
      `${megaApiUrl}/rest/sendMessage/${megaApiInstance}/text`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${megaApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          text: fullMessage,
        }),
      }
    );

    if (!megaResponse.ok) {
      const errorText = await megaResponse.text();
      console.error('Mega API error:', errorText);
      throw new Error(`Failed to send message via Mega API: ${megaResponse.statusText}`);
    }

    const megaData = await megaResponse.json();
    console.log('Mega API response:', megaData);

    // Salvar conversa no banco
    const { data: conversation, error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        carrier_id: carrierId,
        order_id: orderId,
        conversation_type: conversationType,
        message_direction: 'outbound',
        message_content: fullMessage,
        message_metadata: {
          sent_via: 'mega_api',
          phone_number: phoneNumber,
          mega_message_id: megaData.id || null,
        },
        sent_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error saving conversation:', conversationError);
      throw conversationError;
    }

    // Salvar log de mensagem
    await supabase.from('whatsapp_message_log').insert({
      conversation_id: conversation.id,
      mega_message_id: megaData.id || null,
      status: 'sent',
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversation.id,
        megaMessageId: megaData.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
