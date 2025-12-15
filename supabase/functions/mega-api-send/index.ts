import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  carrierId: string;
  orderId?: string; // Optional - for general conversations
  message: string;
  conversationType: string;
  contactType?: string; // 'carrier' | 'customer' | 'technician' | 'supplier'
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

    // Verificar se usuário está autorizado (whitelist OU admin)
    const { data: authData } = await supabase
      .from('whatsapp_authorized_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!authData && !adminRole) {
      throw new Error('User not authorized to send WhatsApp messages');
    }

    const { carrierId, orderId, message, conversationType, contactType }: SendMessageRequest = await req.json();

    // Buscar dados da transportadora
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('id, name, whatsapp')
      .eq('id', carrierId)
      .single();

    if (carrierError || !carrier || !carrier.whatsapp) {
      throw new Error('Carrier not found or WhatsApp not configured');
    }

    // Formatar número de telefone (remover caracteres especiais e adicionar código do país)
    let phoneNumber = carrier.whatsapp.replace(/\D/g, '');
    
    // Garantir código do país 55 (Brasil)
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = `55${phoneNumber}`;
    }

    // Buscar informações do pedido para contexto (opcional)
    let order = null;
    if (orderId) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_number, customer_name')
        .eq('id', orderId)
        .maybeSingle();
      order = orderData;
    }

    // Montar mensagem com contexto
    const fullMessage = order 
      ? `*Pedido ${order.order_number}* - ${order.customer_name}\n\n${message}`
      : message;

    // Buscar instância conectada do banco de dados
    const { data: activeInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .maybeSingle();

    if (!activeInstance) {
      throw new Error('No connected WhatsApp instance found. Please connect a WhatsApp account first.');
    }

    // Enviar mensagem via Mega API com múltiplas tentativas
    let megaApiUrl = (Deno.env.get('MEGA_API_URL') ?? '').trim();
    
    // Garantir que a URL tenha protocolo https
    if (!megaApiUrl.startsWith('http://') && !megaApiUrl.startsWith('https://')) {
      megaApiUrl = `https://${megaApiUrl}`;
    }
    
    // Remover barra final se houver
    megaApiUrl = megaApiUrl.replace(/\/+$/, '');
    
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') ?? '';
    const megaApiInstance = activeInstance.instance_key;
    
    console.log('✅ Using WhatsApp instance from DB:', megaApiInstance);

    console.log('Sending WhatsApp message:', {
      instance: megaApiInstance,
      phoneNumber,
      messagePreview: fullMessage.substring(0, 50)
    });


    

    // Mega API START usa /rest/sendMessage/{instance}/text
    // Ref: https://apistart02.megaapi.com.br/docs/
    const endpoint = `/rest/sendMessage/${megaApiInstance}/text`;
    const fullUrl = `${megaApiUrl}${endpoint}`;

    console.log('Sending to:', fullUrl);

    // Mega API START usa header 'apikey'
    const headers = {
      'apikey': megaApiToken,
      'Content-Type': 'application/json',
    };

    // Formato Mega API START: { messageData: { to: "55XXX", text: "...", linkPreview: false } }
    const body = {
      messageData: {
        to: phoneNumber,
        text: fullMessage,
        linkPreview: false,
      },
    };

    console.log('Request body:', JSON.stringify(body));

    const megaResponse = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await megaResponse.text();
    console.log('Response status:', megaResponse.status);
    console.log('Response body:', responseText.substring(0, 300));

    if (!megaResponse.ok) {
      throw new Error(`Mega API error: ${megaResponse.status} - ${responseText}`);
    }

    let megaData;
    try {
      megaData = JSON.parse(responseText);
    } catch {
      megaData = { raw: responseText };
    }

    console.log('Mega API response:', megaData);

    // Salvar conversa no banco
    const { data: conversation, error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        carrier_id: carrierId,
        order_id: orderId || null,
        conversation_type: conversationType,
        message_direction: 'outbound',
        message_content: fullMessage,
        contact_type: contactType || 'carrier',
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
