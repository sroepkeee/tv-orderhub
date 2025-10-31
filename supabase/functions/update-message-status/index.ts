import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessageStatusUpdate {
  n8n_message_id?: string;
  conversation_id?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  error_message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('update-message-status: Processing status update');
    
    const payload: MessageStatusUpdate = await req.json();
    console.log('Payload received:', JSON.stringify(payload, null, 2));
    
    if (!payload.status || !payload.timestamp) {
      throw new Error('Missing required fields: status, timestamp');
    }

    if (!payload.n8n_message_id && !payload.conversation_id) {
      throw new Error('Either n8n_message_id or conversation_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Encontrar a conversa
    let query = supabase
      .from('carrier_conversations')
      .select('*');

    if (payload.conversation_id) {
      query = query.eq('id', payload.conversation_id);
    } else if (payload.n8n_message_id) {
      query = query.eq('n8n_message_id', payload.n8n_message_id);
    }

    const { data: conversations, error: findError } = await query;

    if (findError || !conversations || conversations.length === 0) {
      console.error('Conversation not found:', findError);
      throw new Error('Conversation not found');
    }

    const conversation = conversations[0];
    console.log('Conversation found:', conversation.id);

    // Preparar dados de atualização baseado no status
    const updateData: Record<string, any> = {};

    switch (payload.status) {
      case 'sent':
        updateData.sent_at = payload.timestamp;
        break;
      case 'delivered':
        updateData.delivered_at = payload.timestamp;
        break;
      case 'read':
        updateData.read_at = payload.timestamp;
        break;
      case 'failed':
        updateData.message_metadata = {
          ...conversation.message_metadata,
          error_message: payload.error_message,
          failed_at: payload.timestamp
        };
        break;
    }

    // Atualizar conversa
    const { data: updatedConversation, error: updateError } = await supabase
      .from('carrier_conversations')
      .update(updateData)
      .eq('id', conversation.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating conversation:', updateError);
      throw new Error('Failed to update conversation');
    }

    console.log('Conversation updated:', updatedConversation.id);

    // Se for uma cotação, atualizar o status da freight_quote também
    if (conversation.quote_id && payload.status === 'delivered') {
      const { error: quoteUpdateError } = await supabase
        .from('freight_quotes')
        .update({ 
          status: 'sent',
          sent_at: payload.timestamp
        })
        .eq('id', conversation.quote_id)
        .eq('status', 'pending'); // Só atualiza se ainda estiver pending

      if (quoteUpdateError) {
        console.error('Error updating quote status:', quoteUpdateError);
      } else {
        console.log('Quote status updated to sent');
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      conversation_id: conversation.id,
      status: payload.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('update-message-status: Error:', error);
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
