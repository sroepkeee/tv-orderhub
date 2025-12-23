import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessChangeRequestPayload {
  requestId: string;
  decision: 'approved' | 'rejected';
  reviewNotes?: string;
  userId: string;
}

// Labels para tipos de alteração
const changeTypeLabels: Record<string, string> = {
  'delivery_address': 'alteração de endereço',
  'delivery_date': 'alteração de data de entrega',
  'add_item': 'adição de item',
  'remove_item': 'remoção de item',
  'change_quantity': 'alteração de quantidade',
  'cancel_order': 'cancelamento de pedido',
  'change_contact': 'alteração de contato',
  'other': 'outra solicitação',
};

// Função para enviar mensagem via Mega API
async function sendWhatsAppMessage(
  phoneNumber: string, 
  message: string, 
  supabase: any
): Promise<boolean> {
  try {
    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';
    
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!instance?.instance_key) {
      console.error('❌ No connected WhatsApp instance found');
      return false;
    }

    let normalizedUrl = megaApiUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
    const sendUrl = `${normalizedUrl}${endpoint}`;

    const body = {
      messageData: {
        to: formattedPhone,
        text: message,
        linkPreview: false,
      }
    };

    console.log(`📤 Sending change request notification to: ${formattedPhone}`);

    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    for (const authHeader of authFormats) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...authHeader,
        };

        const response = await fetch(sendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (response.ok) {
          console.log('✅ Notification sent successfully');
          return true;
        } else if (response.status === 401 || response.status === 403) {
          continue;
        } else {
          const errorText = await response.text();
          console.log(`❌ Failed ${response.status}: ${errorText.substring(0, 100)}`);
          return false;
        }
      } catch (err) {
        console.error('❌ Fetch error:', err);
        continue;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { requestId, decision, reviewNotes, userId }: ProcessChangeRequestPayload = await req.json();
    console.log('📋 Processing change request:', requestId, 'Decision:', decision);

    // 1. Buscar a solicitação
    const { data: request, error: requestError } = await supabase
      .from('customer_change_requests')
      .select(`
        *,
        orders!inner(order_number, customer_name, status),
        customer_contacts(customer_name, whatsapp, phone)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.error('❌ Request not found:', requestError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Solicitação não encontrada' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Solicitação já foi processada' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Atualizar status da solicitação
    const { error: updateError } = await supabase
      .from('customer_change_requests')
      .update({
        status: decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error updating request:', updateError);
      throw updateError;
    }

    console.log('✅ Request status updated to:', decision);

    // 3. Gerar mensagem para o cliente
    const changeLabel = changeTypeLabels[request.change_type] || 'solicitação';
    const orderNumber = request.orders?.order_number;
    
    let clientMessage = '';
    
    if (decision === 'approved') {
      clientMessage = `✅ *Solicitação Aprovada!*

Sua solicitação de *${changeLabel}* para o pedido *#${orderNumber}* foi aprovada.

${request.requested_value ? `✔️ Novo valor: ${request.requested_value}` : ''}
${reviewNotes ? `\n📝 Observação: ${reviewNotes}` : ''}

Qualquer dúvida, estou à disposição! 🙌`;
    } else {
      clientMessage = `ℹ️ *Atualização da sua Solicitação*

Sua solicitação de *${changeLabel}* para o pedido *#${orderNumber}* foi analisada.

❌ Infelizmente não foi possível atender desta vez.
${reviewNotes ? `\n📝 Motivo: ${reviewNotes}` : ''}

Se precisar de algo mais, é só chamar! 📲`;
    }

    // 4. Enviar notificação via WhatsApp
    const customerPhone = request.requested_by_phone || 
                          request.customer_contacts?.whatsapp || 
                          request.customer_contacts?.phone;
    
    if (customerPhone) {
      const messageSent = await sendWhatsAppMessage(customerPhone, clientMessage, supabase);
      
      // Salvar conversa
      if (messageSent) {
        // Buscar carrier_id pelo telefone
        const { data: carrier } = await supabase
          .from('carriers')
          .select('id')
          .ilike('whatsapp', `%${customerPhone.replace(/\D/g, '').slice(-8)}%`)
          .maybeSingle();

        if (carrier) {
          await supabase
            .from('carrier_conversations')
            .insert({
              carrier_id: carrier.id,
              order_id: request.order_id,
              conversation_type: 'general',
              message_direction: 'outbound',
              message_content: clientMessage,
              contact_type: 'customer',
              message_metadata: {
                sent_via: 'change_request_notification',
                request_id: requestId,
                decision: decision,
              },
              sent_at: new Date().toISOString(),
            });
        }
      }
      
      console.log('📲 WhatsApp notification sent:', messageSent);
    } else {
      console.log('⚠️ No phone number found for customer notification');
    }

    // 5. Se aprovado, aplicar alteração (se aplicável)
    if (decision === 'approved') {
      // Por enquanto, apenas marca como 'applied' após notificação
      // Futuro: implementar lógica de alteração automática baseada no change_type
      await supabase
        .from('customer_change_requests')
        .update({ status: 'applied' })
        .eq('id', requestId);
      
      console.log('✅ Request marked as applied');
    }

    return new Response(JSON.stringify({
      success: true,
      decision,
      messageSent: !!customerPhone,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Process Change Request Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
