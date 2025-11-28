import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para extrair dados de cotação da mensagem
function extractQuoteData(messageText: string): {
  freight_value: number | null;
  delivery_time_days: number | null;
} {
  let freight_value: number | null = null;
  let delivery_time_days: number | null = null;

  // Regex para valor do frete (aceita vários formatos)
  const valuePatterns = [
    /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // R$ 1.234,56
    /valor[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // valor: R$ 1.234,56
    /frete[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // frete: R$ 1.234,56
    /cotação[:\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i, // cotação: R$ 1.234,56
  ];

  for (const pattern of valuePatterns) {
    const match = messageText.match(pattern);
    if (match) {
      // Converter formato brasileiro para número
      const cleanValue = match[1].replace(/\./g, '').replace(',', '.');
      freight_value = parseFloat(cleanValue);
      break;
    }
  }

  // Regex para prazo de entrega (aceita vários formatos)
  const timePatterns = [
    /(\d+)\s*dias?\s*(?:úteis)?/i,  // 5 dias, 10 dias úteis
    /prazo[:\s]*(\d+)\s*dias?/i,    // prazo: 5 dias
    /entrega[:\s]*(\d+)\s*dias?/i,  // entrega: 10 dias
  ];

  for (const pattern of timePatterns) {
    const match = messageText.match(pattern);
    if (match) {
      delivery_time_days = parseInt(match[1]);
      break;
    }
  }

  return { freight_value, delivery_time_days };
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

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Validar instância
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
      payload.qrcode ||
      payload.data?.qrcode ||
      payload.qrcode?.base64 ||
      payload.data?.qrcode?.base64 ||
      payload.data?.code ||
      payload.code;

    const isQrCodeEvent = 
      payload.messageType === 'qrcode_update' ||
      payload.event === 'qrcode.updated' ||
      payload.event === 'qrcode' ||
      payload.event === 'qr_code' ||
      payload.event === 'connection.update' && qrcode ||
      !!qrcode;

    if (isQrCodeEvent && qrcode) {
      console.log('QR Code update received');
      
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

    // Processar mensagens recebidas (inbound)
    if (payload.event === 'messages.upsert') {
      const messageData = payload.data;
      
      // Ignorar mensagens enviadas por nós
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

      // Buscar última cotação ativa desta transportadora
      const { data: lastQuote } = await supabase
        .from('freight_quotes')
        .select('id, order_id, status')
        .eq('carrier_id', carrier.id)
        .in('status', ['sent', 'pending'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Tentar extrair dados de cotação da mensagem
      const quoteData = extractQuoteData(messageText);
      const hasQuoteData = quoteData.freight_value !== null || quoteData.delivery_time_days !== null;

      console.log('Extracted quote data:', quoteData, 'Has data:', hasQuoteData);

      let orderId = lastQuote?.order_id;

      // Se não encontrou cotação ativa, buscar última conversa
      if (!orderId) {
        const { data: lastConversation } = await supabase
          .from('carrier_conversations')
          .select('order_id')
          .eq('carrier_id', carrier.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        orderId = lastConversation?.order_id;
      }

      if (!orderId) {
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
          order_id: orderId,
          quote_id: lastQuote?.id || null,
          conversation_type: hasQuoteData ? 'quote_request' : 'follow_up',
          message_direction: 'inbound',
          message_content: messageText,
          message_metadata: {
            received_via: 'mega_api',
            phone_number: phoneNumber,
            mega_message_id: messageData.key?.id || null,
            message_timestamp: messageData.messageTimestamp,
            extracted_quote_data: hasQuoteData ? quoteData : null,
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

      // Se detectou dados de cotação E há cotação ativa, criar resposta automaticamente
      if (hasQuoteData && lastQuote) {
        console.log('Creating automatic quote response for quote:', lastQuote.id);

        const { error: responseError } = await supabase
          .from('freight_quote_responses')
          .insert({
            quote_id: lastQuote.id,
            freight_value: quoteData.freight_value,
            delivery_time_days: quoteData.delivery_time_days,
            response_text: messageText,
            additional_info: {
              auto_extracted: true,
              source: 'whatsapp_mega_api',
              phone_number: phoneNumber,
            },
            received_at: new Date().toISOString(),
          });

        if (responseError) {
          console.error('Error creating quote response:', responseError);
        } else {
          // Atualizar status da cotação para 'responded'
          await supabase
            .from('freight_quotes')
            .update({ 
              status: 'responded',
              response_received_at: new Date().toISOString()
            })
            .eq('id', lastQuote.id);

          console.log('✅ Quote response created successfully');
        }
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
          orderId: orderId,
          quoteResponseCreated: hasQuoteData && !!lastQuote
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else if (payload.event === 'connection.update' || payload.messageType === 'connection_update') {
      console.log('Connection update received');
      
      const connectionData = payload.data || {};
      const connectionMessage = payload.message || connectionData.message;
      
      const isConnected = 
        connectionMessage === 'phone_connected' ||
        connectionData.state === 'open' ||
        connectionData.connection === 'open' ||
        payload.status === 'connected';
      
      const phoneFromJid = payload.jid?.replace('@s.whatsapp.net', '').replace('@lid', '') || 
        connectionData.phoneNumber || 
        payload.phoneNumber || 
        null;
      
      console.log('Connection details:', {
        isConnected,
        phoneNumber: phoneFromJid,
      });
      
      await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: instanceKey,
          status: isConnected ? 'connected' : 'disconnected',
          phone_number: phoneFromJid,
          connected_at: isConnected ? new Date().toISOString() : null,
          qrcode: isConnected ? null : undefined,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_key' });
      
      console.log('Instance status updated successfully');
      
      return new Response(
        JSON.stringify({ success: true, event: 'connection.update', isConnected }),
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
