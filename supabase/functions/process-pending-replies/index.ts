import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone Brasil para formato canônico: 55 + DDD + 9 + NÚMERO
function normalizeBrazilPhone(phone: string): string {
  if (!phone) return phone;
  
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Se começa com +, já foi removido
  // Se tem mais de 13 dígitos, provavelmente tem algo errado
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }
  
  // Adicionar 55 se não tem
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Agora temos: 55 + DDD (2) + número (8 ou 9)
  // Se tem 12 dígitos (55 + 2 + 8), adicionar o 9
  if (digits.length === 12) {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(4);
    digits = '55' + ddd + '9' + numero;
  }
  
  return digits;
}

// Gera variações do telefone para tentar envio (com e sem 9)
function getPhoneVariants(canonical: string): string[] {
  const variants = [canonical];
  
  // Se tem 13 dígitos (55 + DD + 9 + 8), gerar versão sem 9
  if (canonical.length === 13 && canonical.startsWith('55') && canonical.charAt(4) === '9') {
    const withoutNine = canonical.substring(0, 4) + canonical.substring(5);
    variants.push(withoutNine);
  }
  
  // Se tem 12 dígitos (55 + DD + 8), gerar versão com 9
  if (canonical.length === 12 && canonical.startsWith('55')) {
    const ddd = canonical.substring(2, 4);
    const numero = canonical.substring(4);
    const withNine = '55' + ddd + '9' + numero;
    variants.push(withNine);
  }
  
  return variants;
}

// Envia mensagem via Mega API com retry para variações de número
async function sendWhatsAppMessage(
  supabase: any,
  phoneNumber: string,
  message: string,
  carrierId: string | null
): Promise<{ success: boolean; externalMessageId?: string; sentTo?: string; error?: string }> {
  const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
  const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';
  
  if (!megaApiUrl || !megaApiToken) {
    console.error('❌ MEGA_API_URL or MEGA_API_TOKEN not configured');
    return { success: false, error: 'WhatsApp API not configured' };
  }
  
  // Buscar instância conectada
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_key')
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!instance?.instance_key) {
    console.error('❌ No connected WhatsApp instance found');
    return { success: false, error: 'No WhatsApp instance connected' };
  }

  // Normalizar e gerar variações
  const canonical = normalizeBrazilPhone(phoneNumber);
  const variants = getPhoneVariants(canonical);
  
  console.log(`📱 Phone canonical: ${canonical}, variants: ${variants.join(', ')}`);

  // Normalizar URL
  let normalizedUrl = megaApiUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');

  const endpoint = `/rest/sendMessage/${instance.instance_key}/text`;
  const sendUrl = `${normalizedUrl}${endpoint}`;

  // Multi-header fallback
  const authFormats: Record<string, string>[] = [
    { 'apikey': megaApiToken },
    { 'Authorization': `Bearer ${megaApiToken}` },
    { 'Apikey': megaApiToken },
  ];

  // Tentar cada variação de número
  for (const phoneVariant of variants) {
    console.log(`📤 Trying to send to: ${phoneVariant}`);
    
    const body = {
      messageData: {
        to: phoneVariant,
        text: message,
        linkPreview: false,
      }
    };

    // Tentar cada formato de auth
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
          const result = await response.json();
          const externalMessageId = result?.key?.id || result?.messageId || result?.id || null;
          
          console.log(`✅ Message sent successfully to ${phoneVariant}`);
          
          // Registrar conversa outbound
          if (carrierId) {
            await supabase.from('carrier_conversations').insert({
              carrier_id: carrierId,
              conversation_type: 'general',
              message_direction: 'outbound',
              message_content: message,
              contact_type: 'customer',
              n8n_message_id: externalMessageId,
              message_metadata: {
                sent_via: 'ai_auto_reply',
                sent_at: new Date().toISOString(),
                phone_variant_used: phoneVariant,
                canonical_phone: canonical,
              },
              sent_at: new Date().toISOString(),
            });
          }
          
          return { 
            success: true, 
            externalMessageId,
            sentTo: phoneVariant,
          };
        } else if (response.status === 401 || response.status === 403) {
          // Auth failed, try next header
          continue;
        } else {
          const errorText = await response.text();
          console.log(`❌ Send failed ${response.status}: ${errorText.substring(0, 100)}`);
          // Try next phone variant
          break;
        }
      } catch (err) {
        console.error('❌ Fetch error:', err);
        continue;
      }
    }
  }
  
  console.error('❌ All send attempts failed');
  return { success: false, error: 'All send attempts failed' };
}

// Edge function para processar respostas pendentes (debounce)
// Deve ser chamada periodicamente (cron) ou via trigger

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Processing pending AI replies...');

    // Buscar mensagens pendentes onde scheduled_reply_at já passou
    const { data: pendingReplies, error: fetchError } = await supabase
      .from('pending_ai_replies')
      .select('*')
      .is('processed_at', null)
      .lte('scheduled_reply_at', new Date().toISOString())
      .order('scheduled_reply_at', { ascending: true })
      .limit(10); // Processar em batches

    if (fetchError) {
      console.error('❌ Error fetching pending replies:', fetchError);
      throw fetchError;
    }

    if (!pendingReplies || pendingReplies.length === 0) {
      console.log('✅ No pending replies to process');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📬 Found ${pendingReplies.length} pending replies to process`);

    const results = [];

    for (const pending of pendingReplies) {
      try {
        console.log(`\n🔄 Processing pending reply for carrier ${pending.carrier_id}`);
        
        // Normalizar telefone para formato canônico
        const canonicalPhone = normalizeBrazilPhone(pending.sender_phone);
        console.log(`📱 Sender phone: ${pending.sender_phone} -> Canonical: ${canonicalPhone}`);
        
        // Concatenar todas as mensagens do buffer
        const messagesBuffer = pending.messages_buffer as Array<{
          content: string;
          timestamp: string;
          has_media?: boolean;
          media_type?: string;
        }>;

        // Saudações comuns que devem receber resposta mesmo sendo curtas
        const greetings = ['oi', 'olá', 'ola', 'oie', 'opa', 'eai', 'e ai', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey'];
        
        // Verificar se é apenas uma mensagem muito curta que NÃO é saudação
        const firstMessage = messagesBuffer[0]?.content?.toLowerCase()?.trim() || '';
        const isGreeting = greetings.some(g => firstMessage === g || firstMessage.startsWith(g + ' ') || firstMessage.startsWith(g + ',') || firstMessage.startsWith(g + '!'));
        
        // Se só tem uma mensagem muito curta (1-2 chars) E NÃO é saudação, ignorar
        if (messagesBuffer.length === 1 && messagesBuffer[0].content.length <= 2 && !isGreeting) {
          console.log('⏭️ Skipping single short message (likely typing indicator)');
          
          // Marcar como processado mas não enviar resposta
          await supabase
            .from('pending_ai_replies')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          
          results.push({ id: pending.id, skipped: true, reason: 'too_short' });
          continue;
        }

        // Concatenar mensagens em uma única string
        const combinedMessage = messagesBuffer
          .map(m => m.content)
          .filter(c => c && c.trim())
          .join(' ')
          .trim();

        if (!combinedMessage) {
          console.log('⏭️ No message content after combining');
          await supabase
            .from('pending_ai_replies')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          
          results.push({ id: pending.id, skipped: true, reason: 'empty_content' });
          continue;
        }

        console.log(`📝 Combined message (${messagesBuffer.length} parts): ${combinedMessage.substring(0, 100)}...`);

        // Determinar qual função chamar baseado no contact_type
        // ai-agent-auto-reply JÁ ENVIA a mensagem
        // ai-agent-logistics-reply apenas GERA (precisa enviar depois)
        const isLogisticsReply = pending.contact_type === 'customer' || pending.contact_type === 'technician';
        const functionName = isLogisticsReply ? 'ai-agent-logistics-reply' : 'ai-agent-auto-reply';

        // Chamar a função de auto-reply
        const replyResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/${functionName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              message: combinedMessage,
              from_phone: canonicalPhone, // Usar telefone normalizado
              carrier_id: pending.carrier_id,
              conversation_id: pending.conversation_ids?.[0] || null,
              contact_type: pending.contact_type,
              is_debounced: true,
              original_message_count: messagesBuffer.length,
            }),
          }
        );

        const replyResult = await replyResponse.json();
        console.log(`🤖 ${functionName} result:`, JSON.stringify(replyResult, null, 2));

        // Verificar se precisa enviar manualmente (apenas logistics-reply)
        // ai-agent-auto-reply já envia internamente
        let sendResult: { success: boolean; externalMessageId?: string; sentTo?: string; error?: string } = { 
          success: replyResult.sent === true, // Se auto-reply já enviou
          externalMessageId: replyResult.externalMessageId,
        };
        
        if (isLogisticsReply && replyResult.success && replyResult.message) {
          // logistics-reply não envia, precisamos enviar aqui
          console.log('📤 Sending logistics-reply message via WhatsApp...');
          
          sendResult = await sendWhatsAppMessage(
            supabase,
            canonicalPhone,
            replyResult.message,
            pending.carrier_id
          );
          
          if (sendResult.success) {
            console.log(`✅ Message sent! External ID: ${sendResult.externalMessageId}`);
            
            // Atualizar o log de notificação para status 'sent'
            if (replyResult.notificationLogId) {
              await supabase
                .from('ai_notification_log')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  external_message_id: sendResult.externalMessageId,
                  recipient: canonicalPhone,
                })
                .eq('id', replyResult.notificationLogId);
            }
          } else {
            console.error('❌ Failed to send message:', sendResult.error);
            
            // Atualizar log para status 'failed'
            if (replyResult.notificationLogId) {
              await supabase
                .from('ai_notification_log')
                .update({
                  status: 'failed',
                  error_message: sendResult.error || 'Send failed',
                })
                .eq('id', replyResult.notificationLogId);
            }
          }
        } else if (!isLogisticsReply && replyResult.success) {
          // auto-reply já enviou, apenas logar
          console.log(`✅ auto-reply already sent: ${replyResult.sent}`);
        }

        // Marcar como processado
        await supabase
          .from('pending_ai_replies')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', pending.id);

        results.push({
          id: pending.id,
          success: replyResult.success && sendResult.success,
          generated: replyResult.success,
          sent: sendResult.success,
          messageCount: messagesBuffer.length,
          combinedLength: combinedMessage.length,
          externalMessageId: sendResult.externalMessageId,
        });

      } catch (processError) {
        console.error(`❌ Error processing pending reply ${pending.id}:`, processError);
        
        // Marcar como processado mesmo com erro
        await supabase
          .from('pending_ai_replies')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', pending.id);

        results.push({
          id: pending.id,
          error: processError instanceof Error ? processError.message : 'Unknown error',
        });
      }
    }

    console.log(`\n✅ Processed ${results.length} pending replies`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in process-pending-replies:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
