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

    // Validar instância - buscar no banco em vez de secret fixo
    const instanceKey = payload.instance_key || payload.instance;
    console.log('🔑 Instance key received:', instanceKey);
    
    const { data: validInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('instance_key', instanceKey)
      .maybeSingle();
    
    if (!validInstance) {
      console.warn('⚠️ Unknown instance:', instanceKey);
      // Continuar processando mas logar warning
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

    // Processar diferentes tipos de evento de mensagem
    const messageType = payload.messageType || payload.event;
    console.log('📩 Processing event type:', messageType);
    
    if (payload.event === 'messages.upsert' || messageType === 'conversation' || messageType === 'extendedTextMessage') {
      console.log('📩 Processing message event');
      
      // Aceitar payload direto ou aninhado em .data
      const messageData = payload.data || payload;
      const key = payload.key || messageData?.key;
      
      console.log('🔍 Extracted key:', JSON.stringify(key, null, 2));
      
      // Filtrar mensagens de grupos - checar ambos os formatos
      const isGroupMessage = 
        payload.isGroup === true ||
        key?.remoteJid?.endsWith('@g.us');
      
      if (isGroupMessage) {
        console.log('⏭️ Skipping group message');
        return new Response(
          JSON.stringify({ success: true, message: 'Group message ignored' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Ignorar mensagens enviadas por nós
      if (key?.fromMe === true) {
        console.log('⏭️ Ignoring outbound message');
        return new Response(
          JSON.stringify({ success: true, ignored: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Extract phone number - prioritize key.remoteJid for inbound messages
      // For received messages (fromMe: false), the sender is in key.remoteJid
      // payload.jid is the connected instance number
      const remoteJid = 
        key?.remoteJid ||                         // Priority 1: sender's number
        messageData?.key?.remoteJid ||            // Priority 2: fallback
        payload.jid ||                            // Priority 3: instance number (last resort)
        '';
      const phoneNumber = remoteJid
        .replace(/@s\.whatsapp\.net$/g, '')
        .replace(/@lid$/g, '')
        .replace(/\D/g, '');
      
      // Normalize phone number - create ALL possible variations for flexible matching
      // WhatsApp sends: 555199050190 (country 55 + area 51 + 99050190)
      // Database may have: 51999050190, 5199050190, 999050190, etc.
      const phoneVariations: string[] = [];
      
      // Always add original
      phoneVariations.push(phoneNumber); // Ex: 555199050190
      
      // Remove country code 55 if present
      let withoutCountry = phoneNumber;
      if (phoneNumber.startsWith('55') && phoneNumber.length >= 12) {
        withoutCountry = phoneNumber.substring(2); // Ex: 5199050190
        phoneVariations.push(withoutCountry);
      }
      
      // Generate variations with/without leading 9 (mobile prefix)
      // Brazilian mobiles: DDD (2 digits) + 9 + number (8 digits) = 11 digits
      if (withoutCountry.length === 10) {
        // Has 10 digits: DDD + number without 9, add 9
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(2);
        phoneVariations.push(area + '9' + number); // Ex: 51 + 9 + 99050190 = 51999050190
      } else if (withoutCountry.length === 11 && withoutCountry.charAt(2) === '9') {
        // Has 11 digits with 9: DDD + 9 + number, also try without 9
        const area = withoutCountry.substring(0, 2);
        const number = withoutCountry.substring(3);
        phoneVariations.push(area + number); // Ex: 51 + 9050190 = 519050190
      }
      
      // Try just the last 8-9 digits (number without area code)
      if (withoutCountry.length >= 10) {
        phoneVariations.push(withoutCountry.substring(2)); // Remove DDD: 99050190 or 999050190
      }
      
      // Try with country code 55 added if not present
      if (!phoneNumber.startsWith('55')) {
        phoneVariations.push('55' + phoneNumber);
      }
      
      // Remove duplicates
      const uniqueVariations = [...new Set(phoneVariations)];
      
      console.log('📞 Phone variations for search:', uniqueVariations);

      // Extrair mensagem de texto - múltiplas fontes
      const message = payload.message || messageData.message;
      let messageText = '';
      
      if (message?.conversation) {
        messageText = message.conversation;
      } else if (message?.extendedTextMessage?.text) {
        messageText = message.extendedTextMessage.text;
      } else if (message?.imageMessage?.caption) {
        messageText = `[Imagem] ${message.imageMessage.caption}`;
      } else if (message?.documentMessage?.caption) {
        messageText = `[Documento] ${message.documentMessage.caption}`;
      } else if (payload.text) {
        messageText = payload.text;
      } else {
        messageText = '[Mensagem de mídia]';
      }

      console.log('📝 Processing inbound message:', { phoneNumber, messageText });

      // Find carrier by phone number - search all variations
      console.log('🔍 Looking for carrier with WhatsApp variations:', uniqueVariations);
      
      // Build OR query with all phone variations
      const orConditions = uniqueVariations
        .map(variation => `whatsapp.ilike.%${variation}%`)
        .join(',');
      
      const { data: carrier, error: carrierError } = await supabase
        .from('carriers')
        .select('id, name, whatsapp')
        .or(orConditions)
        .maybeSingle();

      if (carrierError) {
        console.error('Error finding carrier:', carrierError);
      }

      // Se não encontrou carrier, buscar em customer_contacts
      let carrierId: string | null = carrier?.id || null;
      let carrierName: string | null = carrier?.name || null;
      let contactType = 'carrier';
      let customerId: string | null = null;
      let customerName: string | null = null;
      
      if (!carrier) {
        console.log('🔍 Carrier not found, searching customer_contacts...');
        
        // Build OR query for customer_contacts - search by whatsapp and phone
        const customerOrConditions = uniqueVariations
          .flatMap(variation => [
            `whatsapp.ilike.%${variation}%`,
            `phone.ilike.%${variation}%`
          ])
          .join(',');
        
        const { data: customer, error: customerError } = await supabase
          .from('customer_contacts')
          .select('id, customer_name, whatsapp, phone, last_order_id')
          .or(customerOrConditions)
          .maybeSingle();
        
        if (customerError) {
          console.error('Error finding customer:', customerError);
        }
        
        if (customer) {
          console.log('✅ Found customer contact:', customer.customer_name);
          customerId = customer.id;
          customerName = customer.customer_name;
          contactType = 'customer';
          
          // Para clientes, precisamos criar um "carrier" temporário para manter compatibilidade
          // ou usar um carrier genérico para clientes
          const customerCarrierName = `Cliente: ${customer.customer_name}`;
          
          // Buscar se já existe um carrier para este cliente
          const { data: existingCarrier } = await supabase
            .from('carriers')
            .select('id, name')
            .eq('whatsapp', phoneNumber)
            .maybeSingle();
          
          if (existingCarrier) {
            carrierId = existingCarrier.id;
            carrierName = existingCarrier.name;
          } else {
            // Criar carrier para o cliente
            const { data: newCarrier, error: createError } = await supabase
              .from('carriers')
              .insert({
                name: customerCarrierName,
                whatsapp: phoneNumber,
                is_active: true,
                notes: `Contato de cliente criado automaticamente - Customer ID: ${customer.id}`,
              })
              .select('id, name')
              .single();
            
            if (!createError && newCarrier) {
              carrierId = newCarrier.id;
              carrierName = newCarrier.name;
              console.log('✅ Created carrier for customer:', newCarrier.id);
            }
          }
        }
      }
      
      // Se ainda não encontrou, criar contato desconhecido
      if (!carrierId) {
        console.log('⚠️ Contact not found anywhere for phone:', phoneNumber, '- Creating unknown contact');
        
        const unknownCarrierName = `Contato ${phoneNumber.slice(-4)}`;
        
        const { data: newCarrier, error: createError } = await supabase
          .from('carriers')
          .insert({
            name: unknownCarrierName,
            whatsapp: phoneNumber,
            is_active: true,
            notes: `Contato criado automaticamente via WhatsApp em ${new Date().toISOString()}`,
          })
          .select('id, name')
          .single();
        
        if (createError) {
          console.error('Error creating unknown carrier:', createError);
          contactType = 'unknown';
        } else {
          carrierId = newCarrier.id;
          carrierName = newCarrier.name;
          console.log('✅ Created new carrier for unknown contact:', newCarrier.id);
        }
      }

      // Buscar última cotação ativa desta transportadora (opcional, apenas se temos carrier)
      let lastQuote: { id: string; order_id: string; status: string } | null = null;
      if (carrierId) {
        const { data: quote } = await supabase
          .from('freight_quotes')
          .select('id, order_id, status')
          .eq('carrier_id', carrierId)
          .in('status', ['sent', 'pending'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastQuote = quote;
      }

      // Tentar extrair dados de cotação da mensagem
      const quoteData = extractQuoteData(messageText);
      const hasQuoteData = quoteData.freight_value !== null || quoteData.delivery_time_days !== null;

      console.log('Extracted quote data:', quoteData, 'Has data:', hasQuoteData);

      let orderId = lastQuote?.order_id || null;

      // Se não encontrou cotação ativa, buscar última conversa (apenas se temos carrier)
      if (!orderId && carrierId) {
        const { data: lastConversation } = await supabase
          .from('carrier_conversations')
          .select('order_id')
          .eq('carrier_id', carrierId)
          .not('order_id', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        orderId = lastConversation?.order_id || null;
      }

      console.log('📦 Related order (optional):', orderId || 'none - general conversation');

      // Salvar mensagem recebida - SEMPRE, mesmo sem carrier (contactType = 'unknown')
      if (!carrierId) {
        console.log('⚠️ Skipping conversation save - no carrier ID available');
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'Message received but no carrier created',
            phoneNumber 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      const { data: conversation, error: conversationError } = await supabase
        .from('carrier_conversations')
        .insert({
          carrier_id: carrierId,
          order_id: orderId,
          quote_id: lastQuote?.id || null,
          conversation_type: hasQuoteData ? 'quote_request' : 'general',
          message_direction: 'inbound',
          message_content: messageText,
          contact_type: contactType,
          message_metadata: {
            received_via: 'mega_api',
            phone_number: phoneNumber,
            mega_message_id: messageData.key?.id || null,
            message_timestamp: messageData.messageTimestamp,
            extracted_quote_data: hasQuoteData ? quoteData : null,
            auto_created_carrier: !carrier,
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

      console.log('✅ Message saved successfully:', conversation.id);

      // 🤖 Trigger AI Agent auto-reply (fire and forget)
      try {
        console.log('🤖 Triggering AI Agent auto-reply...');
        
        // Call the auto-reply function asynchronously
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent-auto-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_content: messageText,
            sender_phone: phoneNumber,
            carrier_id: carrierId,
            carrier_name: carrierName || 'Contato desconhecido',
            order_id: orderId,
            contact_type: contactType,
          }),
        }).then(async (res) => {
          const result = await res.json();
          console.log('🤖 AI auto-reply result:', JSON.stringify(result, null, 2));
        }).catch((err) => {
          console.error('🤖 AI auto-reply error:', err);
        });
        
      } catch (autoReplyError) {
        console.error('🤖 Failed to trigger auto-reply:', autoReplyError);
        // Don't throw - auto-reply failure shouldn't break webhook
      }

      // 📊 Trigger sentiment analysis in background (fire and forget)
      // Only analyze if we have enough messages (3+) or it's been a while since last analysis
      try {
        // Check if we should analyze
        const { data: cachedSentiment } = await supabase
          .from('conversation_sentiment_cache')
          .select('last_analyzed_at, message_count')
          .eq('carrier_id', carrierId)
          .maybeSingle();

        const shouldAnalyze = !cachedSentiment || 
          !cachedSentiment.last_analyzed_at ||
          (new Date().getTime() - new Date(cachedSentiment.last_analyzed_at).getTime() > 5 * 60 * 1000); // 5 min

        if (shouldAnalyze && carrierId) {
          console.log('📊 Triggering sentiment analysis...');
          
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent-conversation-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              carrierId: carrierId,
              contactName: carrierName || 'Contato desconhecido',
            }),
          }).then(async (res) => {
            const result = await res.json();
            console.log('📊 Sentiment analysis result:', result.sentiment, result.score);
          }).catch((err) => {
            console.error('📊 Sentiment analysis error:', err);
          });
        }
      } catch (sentimentError) {
        console.error('📊 Failed to trigger sentiment analysis:', sentimentError);
        // Don't throw - sentiment failure shouldn't break webhook
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          conversationId: conversation.id,
          carrierId: carrierId,
          carrierName: carrierName,
          orderId: orderId,
          contactType: contactType,
          autoCreatedCarrier: !carrier,
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
