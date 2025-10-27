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
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL') || 
      'https://fructos-n8n-start.jtgui9.easypanel.host/webhook-test/bc019a4c-eba6-4ca4-81e6-7d11e5230fb2';
    const n8nApiKey = Deno.env.get('N8N_API_KEY');

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
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
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

      // Registrar conversa IMEDIATAMENTE (antes de tentar N8N)
      const { data: conversation, error: convError } = await supabase
        .from('carrier_conversations')
        .insert({
          order_id: orderId,
          carrier_id: carrierId,
          quote_id: quote.id,
          conversation_type: 'quote_request',
          message_direction: 'outbound',
          message_content: formatQuoteMessage(quoteData),
          message_metadata: {
            channel: carrier.whatsapp ? 'whatsapp' : 'email',
            recipient: carrier.quote_email || carrier.email,
            sent_via_n8n: false,
            n8n_attempted: false
          },
          created_by: userId
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
      }

      // Preparar payload para N8N
      const n8nPayload = {
        quote_id: quote.id,
        order_id: orderId,
        carrier: {
          id: carrier.id,
          name: carrier.name,
          email: carrier.quote_email || carrier.email,
          whatsapp: carrier.whatsapp,
          contact_person: carrier.contact_person
        },
        quote_data: quoteData
      };

      // Tentar enviar via N8N (mas não reverter se falhar)
      let n8nSuccess = false;
      let n8nData: any = null;

      try {
        console.log(`Attempting to send to N8N webhook for carrier ${carrier.name}`);
        
        const n8nHeaders: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        if (n8nApiKey) {
          n8nHeaders['Authorization'] = `Bearer ${n8nApiKey}`;
        }

        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: n8nHeaders,
          body: JSON.stringify(n8nPayload)
        });

        if (n8nResponse.ok) {
          n8nData = await n8nResponse.json();
          n8nSuccess = true;
          console.log('N8N response success:', n8nData);
          
          // Atualizar cotação como enviada
          await supabase
            .from('freight_quotes')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString(),
              n8n_conversation_id: n8nData.conversation_id || n8nData.id
            })
            .eq('id', quote.id);
          
          // Atualizar conversa com dados do N8N
          if (conversation) {
            await supabase
              .from('carrier_conversations')
              .update({
                n8n_message_id: n8nData.message_id || n8nData.id,
                message_metadata: {
                  channel: carrier.whatsapp ? 'whatsapp' : 'email',
                  recipient: carrier.quote_email || carrier.email,
                  sent_via_n8n: true,
                  n8n_attempted: true,
                  n8n_response: n8nData
                }
              })
              .eq('id', conversation.id);
          }
        } else {
          throw new Error(`N8N returned status ${n8nResponse.status}`);
        }
      } catch (n8nError) {
        console.warn(`N8N integration failed for carrier ${carrier.name}, but conversation saved:`, n8nError);
        
        // NÃO reverter - apenas marcar como enviado localmente
        await supabase
          .from('freight_quotes')
          .update({ 
            status: 'sent_locally',
            sent_at: new Date().toISOString()
          })
          .eq('id', quote.id);
        
        // Atualizar conversa com informação de falha
        if (conversation) {
          await supabase
            .from('carrier_conversations')
            .update({
              message_metadata: {
                channel: carrier.whatsapp ? 'whatsapp' : 'email',
                recipient: carrier.quote_email || carrier.email,
                sent_via_n8n: false,
                n8n_attempted: true,
                n8n_error: n8nError instanceof Error ? n8nError.message : 'Unknown error'
              }
            })
            .eq('id', conversation.id);
        }
      }

      // Adicionar ao resultado
      results.push({ 
        quote_id: quote.id,
        carrier_id: carrierId,
        carrier_name: carrier.name,
        status: n8nSuccess ? 'sent' : 'sent_locally',
        n8n_success: n8nSuccess
      });
    }

    console.log('send-freight-quote: Completed. Results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      total: carrierIds.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'error').length
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
