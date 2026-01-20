import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza telefone para formato canônico brasileiro
 */
function normalizePhoneCanonical(phone: string): string {
  if (!phone) return phone;
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length > 13) {
    digits = digits.slice(-13);
  }
  
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
    const ddd = digits.substring(2, 4);
    const numero = digits.substring(5);
    digits = '55' + ddd + numero;
  }
  
  return digits;
}

/**
 * Edge function para processar respostas pendentes (debounce)
 * Agora ENFILEIRA mensagens ao invés de enviar diretamente.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Process Pending Replies - QUEUE MODE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Buscar mensagens pendentes onde scheduled_reply_at já passou
    const { data: pendingReplies, error: fetchError } = await supabase
      .from('pending_ai_replies')
      .select('*')
      .is('processed_at', null)
      .lte('scheduled_reply_at', new Date().toISOString())
      .order('scheduled_reply_at', { ascending: true })
      .limit(10);

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
    let baseDelay = 0;

    for (const pending of pendingReplies) {
      try {
        console.log(`\n🔄 Processing pending reply for carrier ${pending.carrier_id}`);
        
        const canonicalPhone = normalizePhoneCanonical(pending.sender_phone);
        console.log(`📱 Sender phone: ${pending.sender_phone} -> Canonical: ${canonicalPhone}`);
        
        const messagesBuffer = pending.messages_buffer as Array<{
          content: string;
          timestamp: string;
          has_media?: boolean;
          media_type?: string;
        }>;

        // Saudações comuns
        const greetings = ['oi', 'olá', 'ola', 'oie', 'opa', 'eai', 'e ai', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey'];
        
        const firstMessage = messagesBuffer[0]?.content?.toLowerCase()?.trim() || '';
        const isGreeting = greetings.some(g => firstMessage === g || firstMessage.startsWith(g + ' ') || firstMessage.startsWith(g + ',') || firstMessage.startsWith(g + '!'));
        
        // Ignorar mensagens muito curtas que não são saudações
        if (messagesBuffer.length === 1 && messagesBuffer[0].content.length <= 2 && !isGreeting) {
          console.log('⏭️ Skipping single short message');
          
          await supabase
            .from('pending_ai_replies')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          
          results.push({ id: pending.id, skipped: true, reason: 'too_short' });
          continue;
        }

        // Concatenar mensagens
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

        // Determinar qual função chamar
        const isLogisticsReply = pending.contact_type === 'customer' || pending.contact_type === 'technician';
        const functionName = isLogisticsReply ? 'ai-agent-logistics-reply' : 'ai-agent-auto-reply';

        // Chamar a função de geração de resposta
        const replyResponse = await supabase.functions.invoke(functionName, {
          body: {
            message: combinedMessage,
            from_phone: canonicalPhone,
            carrier_id: pending.carrier_id,
            conversation_id: pending.conversation_ids?.[0] || null,
            contact_type: pending.contact_type,
            is_debounced: true,
            original_message_count: messagesBuffer.length,
          },
        });

        const replyResult = replyResponse.data;
        const replyError = replyResponse.error;

        if (replyError) {
          console.error(`❌ Error from ${functionName}:`, replyError);
          
          await supabase
            .from('pending_ai_replies')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', pending.id);
          
          results.push({ id: pending.id, error: replyError.message });
          continue;
        }

        console.log(`🤖 ${functionName} result:`, JSON.stringify(replyResult, null, 2));

        // Se função já enviou diretamente (auto-reply), apenas marcar como processado
        if (!isLogisticsReply && replyResult?.sent === true) {
          console.log(`✅ auto-reply already sent`);
          
          await supabase
            .from('pending_ai_replies')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', pending.id);

          results.push({
            id: pending.id,
            success: true,
            sent_directly: true,
            messageCount: messagesBuffer.length,
          });
          continue;
        }

        // Para logistics-reply ou se auto-reply não enviou, enfileirar
        if (replyResult?.success && replyResult?.message) {
          console.log('📬 Queuing response message...');
          
          const scheduledFor = baseDelay > 0 
            ? new Date(Date.now() + baseDelay).toISOString() 
            : null;

          const { data: queueEntry, error: queueError } = await supabase
            .from('message_queue')
            .insert({
              recipient_whatsapp: canonicalPhone,
              recipient_name: null,
              message_type: 'ai_auto_reply',
              message_content: replyResult.message,
              priority: 2,
              status: 'pending',
              scheduled_for: scheduledFor,
              attempts: 0,
              max_attempts: 3,
              metadata: {
                source: 'process-pending-replies',
                pending_reply_id: pending.id,
                carrier_id: pending.carrier_id,
                contact_type: pending.contact_type,
                function_used: functionName,
                notification_log_id: replyResult.notificationLogId,
                queued_at: new Date().toISOString(),
              },
            })
            .select('id')
            .single();

          if (queueError) {
            console.error('❌ Error queuing message:', queueError);
            
            // Atualizar log como falha
            if (replyResult.notificationLogId) {
              await supabase
                .from('ai_notification_log')
                .update({ status: 'failed', error_message: queueError.message })
                .eq('id', replyResult.notificationLogId);
            }
            
            results.push({ id: pending.id, error: queueError.message });
          } else {
            console.log(`✅ Message queued: ${queueEntry.id}`);
            
            // Atualizar log com referência à fila
            if (replyResult.notificationLogId) {
              await supabase
                .from('ai_notification_log')
                .update({ 
                  status: 'queued',
                  metadata: {
                    queue_id: queueEntry.id,
                    source: 'process-pending-replies',
                  }
                })
                .eq('id', replyResult.notificationLogId);
            }

            results.push({
              id: pending.id,
              success: true,
              queued: true,
              queueId: queueEntry.id,
              messageCount: messagesBuffer.length,
            });

            baseDelay += 5000 + Math.random() * 5000; // 5-10s entre mensagens
          }
        } else {
          console.log('⚠️ No message generated or function failed');
          results.push({ id: pending.id, skipped: true, reason: 'no_message_generated' });
        }

        // Marcar como processado
        await supabase
          .from('pending_ai_replies')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', pending.id);

      } catch (processError) {
        console.error(`❌ Error processing pending reply ${pending.id}:`, processError);
        
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
