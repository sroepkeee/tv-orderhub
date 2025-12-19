import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações de proteção contra bloqueio
const CONFIG = {
  MIN_DELAY_MS: 3000,        // 3 segundos mínimo entre mensagens
  MAX_DELAY_MS: 5000,        // 5 segundos máximo
  JITTER_MS: 1000,           // Variação aleatória adicional
  MAX_PER_BATCH: 10,         // Máximo de mensagens por execução
  MAX_PER_MINUTE: 15,        // Limite de segurança por minuto
  MAX_PER_HOUR: 200,         // Limite por hora
  MAX_RETRIES: 3,            // Tentativas máximas
  BACKOFF_BASE_MS: 10000,    // Base para backoff exponencial (10 seg)
  BACKOFF_MULTIPLIER: 2,     // Multiplicador do backoff
};

// Função para delay com jitter aleatório
function getRandomDelay(): number {
  const baseDelay = CONFIG.MIN_DELAY_MS + 
    Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS);
  const jitter = Math.random() * CONFIG.JITTER_MS;
  return Math.floor(baseDelay + jitter);
}

// Função de sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calcular delay de backoff exponencial
function getBackoffDelay(attempts: number): number {
  return CONFIG.BACKOFF_BASE_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, attempts - 1);
}

interface QueueMessage {
  id: string;
  recipient_whatsapp: string;
  recipient_name: string | null;
  message_type: string;
  message_content: string;
  media_base64: string | null;
  media_caption: string | null;
  media_filename: string | null;
  priority: number;
  status: string;
  attempts: number;
  max_attempts: number;
  metadata: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🚀 Starting message queue processor...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar rate limits
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { count: hourlyCount } = await supabase
      .from('message_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo);

    const { count: minuteCount } = await supabase
      .from('message_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', oneMinuteAgo);

    console.log(`📊 Rate limits - Last hour: ${hourlyCount}/${CONFIG.MAX_PER_HOUR}, Last minute: ${minuteCount}/${CONFIG.MAX_PER_MINUTE}`);

    if ((hourlyCount || 0) >= CONFIG.MAX_PER_HOUR) {
      console.log('⚠️ Hourly rate limit reached, skipping this run');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Hourly rate limit reached',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((minuteCount || 0) >= CONFIG.MAX_PER_MINUTE) {
      console.log('⚠️ Minute rate limit reached, skipping this run');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Minute rate limit reached',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mensagens pendentes ordenadas por prioridade e data de agendamento
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(CONFIG.MAX_PER_BATCH);

    if (fetchError) {
      console.error('❌ Error fetching pending messages:', fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('✅ No pending messages in queue');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending messages',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Found ${pendingMessages.length} pending messages to process`);

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const message of pendingMessages as QueueMessage[]) {
      const messageStartTime = Date.now();
      console.log(`\n📤 Processing message ${message.id} to ${message.recipient_whatsapp}`);
      console.log(`   Type: ${message.message_type}, Priority: ${message.priority}, Attempt: ${message.attempts + 1}`);

      // Marcar como processando
      await supabase
        .from('message_queue')
        .update({ 
          status: 'processing',
          attempts: message.attempts + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', message.id);

      try {
        let success = false;
        let errorMessage = '';

        // Enviar mensagem de texto
        if (message.message_content) {
          const { data: sendResult, error: sendError } = await supabase.functions.invoke('mega-api-send', {
            body: { 
              phoneNumber: message.recipient_whatsapp, 
              message: message.message_content 
            },
          });

          if (sendError) {
            errorMessage = `Text send error: ${sendError.message}`;
            console.error(`   ❌ ${errorMessage}`);
          } else {
            success = true;
            console.log('   ✅ Text message sent');
          }
        }

        // Enviar mídia se houver
        if (success && message.media_base64) {
          console.log('   📎 Sending media attachment...');
          
          // Delay extra antes de enviar mídia
          await sleep(1000);
          
          const { data: mediaResult, error: mediaError } = await supabase.functions.invoke('mega-api-send-media', {
            body: {
              phoneNumber: message.recipient_whatsapp,
              mediaType: 'image',
              base64Data: message.media_base64,
              caption: message.media_caption || '',
              fileName: message.media_filename || 'attachment.png',
            },
          });

          if (mediaError) {
            console.error(`   ⚠️ Media send error: ${mediaError.message}`);
            // Não falhar completamente se a mídia falhar mas o texto foi enviado
          } else {
            console.log('   ✅ Media sent');
          }
        }

        if (success) {
          // Atualizar como enviado
          await supabase
            .from('message_queue')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null
            })
            .eq('id', message.id);

          sentCount++;
          results.push({ id: message.id, status: 'sent' });
          console.log(`   ✅ Message ${message.id} sent successfully`);
        } else {
          throw new Error(errorMessage || 'Unknown send error');
        }

      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        console.error(`   ❌ Error processing message ${message.id}:`, errorMsg);

        const newAttempts = message.attempts + 1;
        
        if (newAttempts >= message.max_attempts) {
          // Atingiu limite de tentativas - marcar como falhou
          await supabase
            .from('message_queue')
            .update({ 
              status: 'failed',
              error_message: errorMsg
            })
            .eq('id', message.id);
          
          failedCount++;
          results.push({ id: message.id, status: 'failed', error: errorMsg });
          console.log(`   ⛔ Message ${message.id} failed permanently after ${newAttempts} attempts`);
        } else {
          // Agendar retry com backoff exponencial
          const backoffDelay = getBackoffDelay(newAttempts);
          const nextRetry = new Date(Date.now() + backoffDelay).toISOString();
          
          await supabase
            .from('message_queue')
            .update({ 
              status: 'pending',
              scheduled_for: nextRetry,
              error_message: errorMsg
            })
            .eq('id', message.id);
          
          console.log(`   🔄 Message ${message.id} scheduled for retry at ${nextRetry} (backoff: ${backoffDelay}ms)`);
        }
      }

      const messageTime = Date.now() - messageStartTime;
      console.log(`   ⏱️ Message processing time: ${messageTime}ms`);

      // Delay obrigatório antes da próxima mensagem (exceto na última)
      if (pendingMessages.indexOf(message) < pendingMessages.length - 1) {
        const delay = getRandomDelay();
        console.log(`   ⏳ Waiting ${delay}ms before next message...`);
        await sleep(delay);
      }
    }

    // Atualizar estatísticas
    const today = new Date().toISOString().split('T')[0];
    try {
      // Upsert manual nas estatísticas
      const { data: existingStats } = await supabase
        .from('message_queue_stats')
        .select('*')
        .eq('stat_date', today)
        .single();

      if (existingStats) {
        await supabase
          .from('message_queue_stats')
          .update({
            total_queued: (existingStats.total_queued || 0) + pendingMessages.length,
            total_sent: (existingStats.total_sent || 0) + sentCount,
            total_failed: (existingStats.total_failed || 0) + failedCount,
          })
          .eq('stat_date', today);
      } else {
        await supabase
          .from('message_queue_stats')
          .insert({
            stat_date: today,
            total_queued: pendingMessages.length,
            total_sent: sentCount,
            total_failed: failedCount,
          });
      }
      console.log('📊 Stats updated successfully');
    } catch (statsError) {
      console.log('📊 Stats update skipped:', statsError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Queue processing complete in ${totalTime}ms`);
    console.log(`   Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: pendingMessages.length,
        sent: sentCount,
        failed: failedCount,
        results,
        processingTimeMs: totalTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Fatal error in queue processor:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
