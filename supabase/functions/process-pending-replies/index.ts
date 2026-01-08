import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        
        // Concatenar todas as mensagens do buffer
        const messagesBuffer = pending.messages_buffer as Array<{
          content: string;
          timestamp: string;
          has_media?: boolean;
          media_type?: string;
        }>;

        // Se só tem uma mensagem muito curta (1-2 chars), ignorar (provavelmente digitando)
        if (messagesBuffer.length === 1 && messagesBuffer[0].content.length <= 2) {
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
        const functionName = pending.contact_type === 'customer' 
          ? 'ai-agent-logistics-reply' 
          : 'ai-agent-auto-reply';

        // Chamar a função de auto-reply apropriada
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
              from_phone: pending.sender_phone,
              carrier_id: pending.carrier_id,
              conversation_id: pending.conversation_ids?.[0] || null,
              contact_type: pending.contact_type,
              // Passar flag indicando que são mensagens combinadas
              is_debounced: true,
              original_message_count: messagesBuffer.length,
            }),
          }
        );

        const replyResult = await replyResponse.json();
        console.log(`🤖 ${functionName} result:`, JSON.stringify(replyResult, null, 2));

        // Marcar como processado
        await supabase
          .from('pending_ai_replies')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', pending.id);

        results.push({
          id: pending.id,
          success: replyResult.success,
          messageCount: messagesBuffer.length,
          combinedLength: combinedMessage.length,
        });

      } catch (processError) {
        console.error(`❌ Error processing pending reply ${pending.id}:`, processError);
        
        // Marcar como processado mesmo com erro para evitar loop infinito
        await supabase
          .from('pending_ai_replies')
          .update({ 
            processed_at: new Date().toISOString(),
          })
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
