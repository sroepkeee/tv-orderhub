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

// Normalizar telefone no padrão canônico (55 + DDD + 8 dígitos)
function normalizePhoneCanonical(phone: string): string {
  if (!phone) return phone;
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }
  
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Remover o 9 se presente
  if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(5);
    digits = '55' + ddd + numero;
  }
  
  return digits;
}

// Enfileirar mensagem de cotação (ao invés de enviar diretamente)
async function queueFreightQuoteMessage(
  supabase: any,
  carrierId: string,
  carrierName: string,
  carrierWhatsApp: string,
  message: string,
  orderId: string,
  quoteId: string
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const normalizedPhone = normalizePhoneCanonical(carrierWhatsApp);
    
    if (!normalizedPhone || normalizedPhone.length < 10) {
      console.error('❌ Invalid phone number:', carrierWhatsApp);
      return { success: false, error: 'Invalid phone number' };
    }
    
    console.log(`📤 Queueing freight quote to: ${normalizedPhone} (carrier: ${carrierName})`);
    
    const { data: queueEntry, error: queueError } = await supabase
      .from('message_queue')
      .insert({
        recipient_whatsapp: normalizedPhone,
        recipient_name: carrierName,
        message_type: 'freight_quote_request',
        message_content: message,
        priority: 2, // Alta prioridade para cotações
        status: 'pending',
        scheduled_for: null,
        attempts: 0,
        max_attempts: 3,
        metadata: {
          source: 'send-freight-quote',
          order_id: orderId,
          carrier_id: carrierId,
          quote_id: quoteId,
          queued_at: new Date().toISOString(),
        }
      })
      .select('id')
      .single();
    
    if (queueError) {
      console.error('❌ Error queueing freight quote:', queueError);
      return { success: false, error: queueError.message };
    }
    
    console.log('✅ Freight quote queued. Queue ID:', queueEntry?.id);
    return { success: true, queueId: queueEntry?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Exception queueing freight quote:', errorMessage);
    return { success: false, error: errorMessage };
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      let queueSuccess = false;
      let queueId: string | undefined;

      // ENFILEIRAR mensagem ao invés de enviar diretamente
      if (carrier.whatsapp) {
        console.log(`📤 Queueing freight quote for ${carrier.name}`);
        const queueResult = await queueFreightQuoteMessage(
          supabase,
          carrierId,
          carrier.name,
          carrier.whatsapp,
          formattedMessage,
          orderId,
          quote.id
        );

        queueSuccess = queueResult.success;
        queueId = queueResult.queueId;
        
        if (queueSuccess) {
          console.log(`✅ Quote queued for ${carrier.name}`);
        } else {
          console.warn(`⚠️ Failed to queue quote for ${carrier.name}:`, queueResult.error);
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
            sent_via: queueSuccess ? 'queued' : 'none',
            queue_id: queueId || null,
            has_whatsapp: !!carrier.whatsapp
          },
          sent_at: null, // Será preenchido quando process-message-queue enviar
          delivered_at: null,
          created_by: userId
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
      }

      // Atualizar status da cotação para 'queued' ao invés de 'sent'
      await supabase
        .from('freight_quotes')
        .update({ 
          status: queueSuccess ? 'queued' : 'pending',
        })
        .eq('id', quote.id);

      results.push({ 
        quote_id: quote.id,
        carrier_id: carrierId,
        carrier_name: carrier.name,
        status: queueSuccess ? 'queued' : 'pending',
        queue_id: queueId,
        has_whatsapp: !!carrier.whatsapp
      });
    }

    console.log('send-freight-quote: Completed. Results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      total: carrierIds.length,
      queued: results.filter(r => r.status === 'queued').length,
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
