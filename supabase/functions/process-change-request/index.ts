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

// Aplicar alteração automaticamente no pedido
async function applyChangeToOrder(
  supabase: any,
  request: any,
  order: any
): Promise<{ success: boolean; message: string }> {
  try {
    const { change_type, requested_value, order_id } = request;

    switch (change_type) {
      case 'delivery_date': {
        if (!requested_value) {
          return { success: false, message: 'Nenhum valor de data especificado' };
        }
        
        // Try to parse the date
        let newDate: Date | null = null;
        
        // Try different date formats
        const datePatterns = [
          /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, // DD/MM or DD/MM/YYYY
          /dia\s*(\d{1,2})/i, // dia XX
        ];
        
        for (const pattern of datePatterns) {
          const match = requested_value.match(pattern);
          if (match) {
            const day = parseInt(match[1]);
            const month = match[2] ? parseInt(match[2]) - 1 : new Date().getMonth();
            const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : new Date().getFullYear();
            newDate = new Date(year, month, day);
            break;
          }
        }

        if (!newDate || isNaN(newDate.getTime())) {
          // If we can't parse, log history but don't apply
          console.log('⚠️ Could not parse date, skipping auto-apply');
          return { success: false, message: 'Data não pôde ser interpretada automaticamente' };
        }

        const oldDate = order.delivery_date;
        
        // Update the order
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            delivery_date: newDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);

        if (updateError) throw updateError;

        // Log the change in delivery_date_changes
        await supabase
          .from('delivery_date_changes')
          .insert({
            order_id: order_id,
            old_date: oldDate,
            new_date: newDate.toISOString().split('T')[0],
            changed_by: request.reviewed_by,
            reason: `Solicitação de cliente via WhatsApp: ${request.description}`,
            change_source: 'customer_request',
            organization_id: order.organization_id,
          });

        return { 
          success: true, 
          message: `Data alterada de ${oldDate ? new Date(oldDate).toLocaleDateString('pt-BR') : 'não definida'} para ${newDate.toLocaleDateString('pt-BR')}` 
        };
      }

      case 'delivery_address': {
        if (!requested_value) {
          return { success: false, message: 'Nenhum endereço especificado' };
        }

        const oldAddress = order.delivery_address;
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            delivery_address: requested_value,
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);

        if (updateError) throw updateError;

        // Log in order_change_history if table exists
        try {
          await supabase
            .from('order_change_history')
            .insert({
              order_id: order_id,
              field_name: 'delivery_address',
              old_value: oldAddress,
              new_value: requested_value,
              changed_by: request.reviewed_by,
              change_reason: `Solicitação de cliente via WhatsApp`,
            });
        } catch (e) {
          // Table might not exist, that's ok
          console.log('⚠️ Could not log to order_change_history');
        }

        return { 
          success: true, 
          message: `Endereço alterado para: ${requested_value}` 
        };
      }

      case 'cancel_order': {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);

        if (updateError) throw updateError;

        return { success: true, message: 'Pedido cancelado' };
      }

      default:
        // For other change types, just mark as applied without auto-applying
        return { 
          success: false, 
          message: `Alteração do tipo "${changeTypeLabels[change_type]}" requer ação manual` 
        };
    }
  } catch (error: any) {
    console.error('❌ Error applying change:', error);
    return { success: false, message: error.message };
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
        orders!inner(id, order_number, customer_name, status, delivery_date, delivery_address, organization_id),
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

    // 3. Se aprovado, tentar aplicar alteração automaticamente
    let applyResult = { success: false, message: '' };
    
    if (decision === 'approved') {
      applyResult = await applyChangeToOrder(supabase, request, request.orders);
      console.log('🔧 Auto-apply result:', applyResult);
      
      // Update status to 'applied' if successful
      if (applyResult.success) {
        await supabase
          .from('customer_change_requests')
          .update({ status: 'applied' })
          .eq('id', requestId);
      }
    }

    // 4. Gerar mensagem para o cliente
    const changeLabel = changeTypeLabels[request.change_type] || 'solicitação';
    const orderNumber = request.orders?.order_number;
    
    let clientMessage = '';
    
    if (decision === 'approved') {
      clientMessage = `✅ *Solicitação Aprovada!*

Sua solicitação de *${changeLabel}* para o pedido *#${orderNumber}* foi aprovada.

${applyResult.success 
  ? `✔️ ${applyResult.message}` 
  : request.requested_value 
    ? `📌 Valor solicitado: ${request.requested_value}` 
    : ''}
${reviewNotes ? `\n📝 Observação: ${reviewNotes}` : ''}

Qualquer dúvida, estou à disposição! 🙌`;
    } else {
      clientMessage = `ℹ️ *Atualização da sua Solicitação*

Sua solicitação de *${changeLabel}* para o pedido *#${orderNumber}* foi analisada.

❌ Infelizmente não foi possível atender desta vez.
${reviewNotes ? `\n📝 Motivo: ${reviewNotes}` : ''}

Se precisar de algo mais, é só chamar! 📲`;
    }

    // 5. Enviar notificação via WhatsApp
    const customerPhone = request.requested_by_phone || 
                          request.customer_contacts?.whatsapp || 
                          request.customer_contacts?.phone;
    
    let messageSent = false;
    if (customerPhone) {
      messageSent = await sendWhatsAppMessage(customerPhone, clientMessage, supabase);
      
      // Salvar conversa
      if (messageSent) {
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
                auto_applied: applyResult.success,
              },
              sent_at: new Date().toISOString(),
            });
        }
      }
      
      console.log('📲 WhatsApp notification sent:', messageSent);
    } else {
      console.log('⚠️ No phone number found for customer notification');
    }

    return new Response(JSON.stringify({
      success: true,
      decision,
      messageSent,
      autoApplied: applyResult.success,
      applyMessage: applyResult.message,
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
