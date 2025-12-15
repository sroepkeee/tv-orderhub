import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendQuoteRequest {
  orderId: string;
  carrierIds: string[];
  quoteData: any;
}

function formatQuoteMessage(quoteData: any): string {
  let message = `📦 SOLICITAÇÃO DE COTAÇÃO DE FRETE\n\n`;
  
  // 1. REMETENTE
  message += `🏢 REMETENTE:\n`;
  message += `   Empresa: ${quoteData.sender_company}\n`;
  message += `   CNPJ: ${quoteData.sender_cnpj}\n`;
  message += `   Telefone: ${quoteData.sender_phone}\n`;
  message += `   Endereço: ${quoteData.sender_address}\n\n`;
  
  // 2. DESTINATÁRIO
  message += `📍 DESTINATÁRIO:\n`;
  message += `   Nome: ${quoteData.recipient_name}\n`;
  message += `   Cidade/UF: ${quoteData.recipient_city}/${quoteData.recipient_state}\n`;
  message += `   Endereço: ${quoteData.recipient_address}\n\n`;
  
  // 3. CARGA - VOLUMES DETALHADOS
  message += `📦 CARGA:\n`;
  message += `   Produto: ${quoteData.product_description}\n\n`;
  
  if (quoteData.detailed_volumes && quoteData.detailed_volumes.length > 0) {
    message += `   VOLUMES DETALHADOS:\n`;
    quoteData.detailed_volumes.forEach((vol: any, idx: number) => {
      message += `   \n   Volume ${idx + 1}:\n`;
      message += `      • Quantidade: ${vol.quantity > 1 ? `${vol.quantity} volumes` : '1 volume'}\n`;
      message += `      • Peso unitário: ${vol.weight_kg} kg\n`;
      message += `      • Dimensões: ${vol.dimensions.length_cm}cm x ${vol.dimensions.width_cm}cm x ${vol.dimensions.height_cm}cm\n`;
      message += `      • Cubagem: ${vol.cubagem_m3.toFixed(3)} m³\n`;
      message += `      • Embalagem: ${vol.packaging_type}\n`;
      if (vol.description) {
        message += `      • Observação: ${vol.description}\n`;
      }
    });
    
    message += `\n   TOTAIS:\n`;
    message += `      • Total de volumes: ${quoteData.volume_totals.total_volumes}\n`;
    message += `      • Peso total: ${quoteData.volume_totals.total_weight_kg.toFixed(2)} kg\n`;
    message += `      • Cubagem total: ${quoteData.volume_totals.total_cubagem_m3.toFixed(3)} m³\n`;
  } else {
    // Fallback para formato resumido
    message += `   Volumes: ${quoteData.volumes}\n`;
    message += `   Peso total: ${quoteData.weight_kg} kg\n`;
    message += `   Dimensões: ${quoteData.length_m}m x ${quoteData.width_m}m x ${quoteData.height_m}m\n`;
    message += `   Embalagem: ${quoteData.package_type}\n`;
  }
  
  // 4. OPERACIONAL
  message += `\n💼 INFORMAÇÕES OPERACIONAIS:\n`;
  message += `   Tipo de frete: ${quoteData.freight_type}\n`;
  message += `   Tomador: ${quoteData.freight_payer}\n`;
  message += `   Valor declarado: R$ ${quoteData.declared_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  message += `   Seguro: ${quoteData.requires_insurance ? 'SIM' : 'NÃO'}\n`;
  
  if (quoteData.observations) {
    message += `\n📝 OBSERVAÇÕES:\n   ${quoteData.observations}\n`;
  }
  
  return message;
}

// Função para enviar via Mega API com múltiplas tentativas
async function sendViaMegaApi(
  carrierWhatsApp: string, 
  message: string,
  megaApiUrl: string,
  megaApiToken: string,
  megaApiInstance: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Normalizar URL
    let baseUrl = megaApiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    // Formatar número (remover caracteres especiais)
    const cleanNumber = carrierWhatsApp.replace(/\D/g, '');
    const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
    
    console.log('Sending via Mega API to:', formattedNumber);

    // Mega API Plan Code usa /rest/sendMessage/{instance}/text
    const endpoints = [
      `/rest/sendMessage/${megaApiInstance}/text`,
    ];

    const authHeadersList: Array<Record<string, string>> = [
      { 'Authorization': `Bearer ${megaApiToken}`, 'Content-Type': 'application/json' },
    ];

    // Formato correto: messageData com @s.whatsapp.net
    const phoneWithSuffix = `${formattedNumber}@s.whatsapp.net`;
    const bodyFormats = [
      { messageData: { to: phoneWithSuffix, text: message } },
    ];

    let lastError = '';

    for (const endpoint of endpoints) {
      for (const headers of authHeadersList) {
        for (const body of bodyFormats) {
          const fullUrl = `${baseUrl}${endpoint}`;
          console.log(`Trying endpoint: ${fullUrl}`);

          try {
            const response = await fetch(fullUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });

            if (response.ok) {
              const data = await response.json();
              console.log(`✅ Success with endpoint: ${endpoint}`);
              return { 
                success: true, 
                messageId: data.key?.id || data.message_id || data.id 
              };
            } else {
              const errorText = await response.text();
              lastError = `${response.status}: ${errorText}`;
              console.log(`❌ Failed (${response.status})`);
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
        }
      }
    }

    console.error('All Mega API attempts failed. Last error:', lastError);
    return { success: false, error: `Mega API error: ${lastError}` };
  } catch (error) {
    console.error('Error sending via Mega API:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('send-freight-quote: Processing request');
    
    const { orderId, carrierIds, quoteData }: SendQuoteRequest = await req.json();
    
    if (!orderId || !carrierIds || carrierIds.length === 0 || !quoteData) {
      throw new Error('Missing required fields: orderId, carrierIds, quoteData');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const megaApiUrl = Deno.env.get('MEGA_API_URL')!;
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar instância conectada do banco de dados
    const { data: activeInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .maybeSingle();

    if (!activeInstance) {
      console.warn('⚠️ No connected WhatsApp instance found. Messages will be saved locally only.');
    }

    const megaApiInstance = activeInstance?.instance_key || '';
    console.log('✅ Using WhatsApp instance from DB:', megaApiInstance || 'none');

    // Get user ID from authorization header
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const results = [];
    
    for (const carrierId of carrierIds) {
      console.log(`Processing carrier: ${carrierId}`);
      
      // Buscar dados da transportadora
      const { data: carrier, error: carrierError } = await supabase
        .from('carriers')
        .select('*')
        .eq('id', carrierId)
        .single();

      if (carrierError || !carrier) {
        console.error(`Carrier not found: ${carrierId}`, carrierError);
        results.push({ 
          carrier_id: carrierId, 
          status: 'error', 
          error: 'Carrier not found' 
        });
        continue;
      }

      // Criar registro de cotação
      const { data: quote, error: quoteError } = await supabase
        .from('freight_quotes')
        .insert({
          order_id: orderId,
          carrier_id: carrierId,
          quote_request_data: quoteData,
          status: 'pending',
          created_by: userId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (quoteError || !quote) {
        console.error(`Error creating quote for carrier ${carrierId}:`, quoteError);
        results.push({ 
          carrier_id: carrierId, 
          status: 'error', 
          error: 'Failed to create quote' 
        });
        continue;
      }

      const formattedMessage = formatQuoteMessage(quoteData);
      let sendSuccess = false;
      let sentVia = 'none';
      let megaMessageId: string | undefined;

      // PRIORIDADE 1: Tentar enviar via Mega API se tiver WhatsApp
      if (carrier.whatsapp) {
        console.log(`Attempting to send via Mega API to ${carrier.name}`);
        const megaResult = await sendViaMegaApi(
          carrier.whatsapp,
          formattedMessage,
          megaApiUrl,
          megaApiToken,
          megaApiInstance
        );

        if (megaResult.success) {
          sendSuccess = true;
          sentVia = 'mega_api';
          megaMessageId = megaResult.messageId;
          console.log(`✅ Mega API send successful for ${carrier.name}`);
        } else {
          console.warn(`⚠️ Mega API failed for ${carrier.name}:`, megaResult.error);
        }
      } else {
        console.log(`📧 Carrier ${carrier.name} has no WhatsApp - will save locally`);
      }

      // Registrar conversa
      const { data: conversation, error: convError } = await supabase
        .from('carrier_conversations')
        .insert({
          order_id: orderId,
          carrier_id: carrierId,
          quote_id: quote.id,
          conversation_type: 'quote_request',
          message_direction: 'outbound',
          message_content: formattedMessage,
          message_metadata: {
            channel: carrier.whatsapp ? 'whatsapp' : 'no_whatsapp',
            recipient: carrier.whatsapp || carrier.quote_email || carrier.email,
            sent_via: sentVia,
            mega_message_id: megaMessageId || null,
            has_whatsapp: !!carrier.whatsapp
          },
          sent_at: sendSuccess ? new Date().toISOString() : null,
          delivered_at: sendSuccess ? new Date().toISOString() : null,
          created_by: userId
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
      }

      // Atualizar status da cotação
      await supabase
        .from('freight_quotes')
        .update({ 
          status: sendSuccess ? 'sent' : 'pending',
          sent_at: sendSuccess ? new Date().toISOString() : null
        })
        .eq('id', quote.id);

      // Log de mensagem WhatsApp
      if (conversation && megaMessageId) {
        await supabase.from('whatsapp_message_log').insert({
          conversation_id: conversation.id,
          mega_message_id: megaMessageId,
          status: 'sent',
        });
      }

      results.push({ 
        quote_id: quote.id,
        carrier_id: carrierId,
        carrier_name: carrier.name,
        status: sendSuccess ? 'sent' : 'pending',
        sent_via: sentVia,
        has_whatsapp: !!carrier.whatsapp
      });
    }

    console.log('send-freight-quote: Completed. Results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      total: carrierIds.length,
      sent: results.filter(r => r.status === 'sent').length,
      pending: results.filter(r => r.status === 'pending').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('send-freight-quote: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
