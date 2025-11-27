import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Validar instância (verificar ambos instance_key e instance para compatibilidade)
    const megaApiInstance = Deno.env.get('MEGA_API_INSTANCE') ?? '';
    const instanceKey = payload.instance_key || payload.instance;
    
    if (instanceKey !== megaApiInstance) {
      console.warn('Invalid instance:', instanceKey, 'Expected:', megaApiInstance);
      return new Response(
        JSON.stringify({ error: 'Invalid instance' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Processar QR Code Update
    const qrcode = 
      payload.qrcode ||                           // formato 1: qrcode direto
      payload.data?.qrcode ||                     // formato 2: dentro de data
      payload.qrcode?.base64 ||                   // formato 3: base64 dentro de qrcode
      payload.data?.qrcode?.base64 ||             // formato 4: base64 dentro de data.qrcode
      payload.data?.code ||                       // formato 5: code dentro de data
      payload.code;                               // formato 6: code direto

    const isQrCodeEvent = 
      payload.messageType === 'qrcode_update' ||
      payload.event === 'qrcode.updated' ||
      payload.event === 'qrcode' ||
      payload.event === 'qr_code' ||
      payload.event === 'connection.update' && qrcode ||
      !!qrcode;

    if (isQrCodeEvent && qrcode) {
      console.log('QR Code update received:', { 
        instanceKey, 
        hasQrcode: !!qrcode,
        event: payload.event,
        messageType: payload.messageType 
      });
      
      // Salvar QR code no cache
      const { error: upsertError } = await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          qrcode: qrcode,
          qrcode_updated_at: new Date().toISOString(),
          status: 'waiting_scan',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_key' });

      if (upsertError) {
        console.error('Error saving QR code:', upsertError);
        throw upsertError;
      }

      console.log('QR code cached successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          event: 'qrcode_update',
          cached: true 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Processar diferentes tipos de eventos
    if (payload.event === 'messages.upsert') {
      const messageData = payload.data;
      
      // Ignorar mensagens enviadas por nós (fromMe = true)
      if (messageData.key?.fromMe) {
        console.log('Ignoring outbound message');
        return new Response(
          JSON.stringify({ success: true, ignored: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Extrair número de telefone
      const remoteJid = messageData.key?.remoteJid || '';
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');

      // Extrair mensagem de texto
      let messageText = '';
      if (messageData.message?.conversation) {
        messageText = messageData.message.conversation;
      } else if (messageData.message?.extendedTextMessage?.text) {
        messageText = messageData.message.extendedTextMessage.text;
      } else if (messageData.message?.imageMessage?.caption) {
        messageText = `[Imagem] ${messageData.message.imageMessage.caption}`;
      } else if (messageData.message?.documentMessage?.caption) {
        messageText = `[Documento] ${messageData.message.documentMessage.caption}`;
      } else {
        messageText = '[Mensagem de mídia]';
      }

      console.log('Processing inbound message:', { phoneNumber, messageText });

      // Buscar transportadora pelo número de WhatsApp
      const { data: carrier, error: carrierError } = await supabase
        .from('carriers')
        .select('id, name, whatsapp')
        .ilike('whatsapp', `%${phoneNumber}%`)
        .maybeSingle();

      if (carrierError) {
        console.error('Error finding carrier:', carrierError);
        throw carrierError;
      }

      if (!carrier) {
        console.warn('Carrier not found for phone:', phoneNumber);
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'Carrier not found',
            phoneNumber 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Buscar última conversa ativa com esta transportadora
      const { data: lastConversation } = await supabase
        .from('carrier_conversations')
        .select('order_id')
        .eq('carrier_id', carrier.id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastConversation) {
        console.warn('No active conversation found for carrier:', carrier.id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'No active conversation',
            carrierId: carrier.id 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Salvar mensagem recebida
      const { data: conversation, error: conversationError } = await supabase
        .from('carrier_conversations')
        .insert({
          carrier_id: carrier.id,
          order_id: lastConversation.order_id,
          conversation_type: 'follow_up',
          message_direction: 'inbound',
          message_content: messageText,
          message_metadata: {
            received_via: 'mega_api',
            phone_number: phoneNumber,
            mega_message_id: messageData.key?.id || null,
            message_timestamp: messageData.messageTimestamp,
          },
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
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
        mega_message_id: messageData.key?.id || null,
        status: 'received',
      });

      console.log('Message saved successfully:', conversation.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          conversationId: conversation.id,
          carrierId: carrier.id,
          orderId: lastConversation.order_id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else if (payload.event === 'connection.update') {
      console.log('Connection update:', payload.data);
      
      // Atualizar status da instância
      const connectionData = payload.data || {};
      const isConnected = connectionData.state === 'open' || connectionData.connection === 'open';
      
      await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          status: isConnected ? 'connected' : 'disconnected',
          phone_number: connectionData.phoneNumber || null,
          connected_at: isConnected ? new Date().toISOString() : null,
          qrcode: null, // Limpar QR code quando conectado
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_key' });
      
      return new Response(
        JSON.stringify({ success: true, event: 'connection.update' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event: payload.event }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in mega-api-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
