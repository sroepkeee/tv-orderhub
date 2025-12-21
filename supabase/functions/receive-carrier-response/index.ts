import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface CarrierResponse {
  quote_id: string;
  response_data: {
    freight_value?: number;
    delivery_time_days?: number;
    raw_message: string;
    additional_info?: Record<string, any>;
    responded_by?: string;
  };
  n8n_message_id?: string;
  carrier_identifier?: string; // email ou whatsapp para identificar transportadora
}

// Função para validar API Key (N8N ou sistema externo)
function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  const expectedKey = Deno.env.get('N8N_API_KEY');
  
  if (!expectedKey) {
    console.warn('⚠️ N8N_API_KEY not configured - security risk!');
    return false;
  }
  
  if (!apiKey) {
    console.warn('⚠️ No API key provided in request');
    return false;
  }
  
  // Comparação segura (timing-safe não disponível em Deno, mas minimizamos risco)
  return apiKey === expectedKey;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('receive-carrier-response: Processing webhook');
    
    // ✅ SECURITY: Validar API Key antes de processar
    if (!validateApiKey(req)) {
      console.error('❌ SECURITY: Invalid or missing API key');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized - Invalid API key' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ API key validated successfully');
    
    const payload: CarrierResponse = await req.json();
    console.log('Payload received:', JSON.stringify(payload, null, 2));
    
    if (!payload.quote_id || !payload.response_data) {
      throw new Error('Missing required fields: quote_id, response_data');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar cotação
    const { data: quote, error: quoteError } = await supabase
      .from('freight_quotes')
      .select('*, carrier_id, order_id')
      .eq('id', payload.quote_id)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    console.log('Quote found:', quote.id);

    // Salvar resposta
    const { data: response, error: responseError } = await supabase
      .from('freight_quote_responses')
      .insert({
        quote_id: payload.quote_id,
        freight_value: payload.response_data.freight_value,
        delivery_time_days: payload.response_data.delivery_time_days,
        response_text: payload.response_data.raw_message,
        additional_info: payload.response_data.additional_info || {},
        responded_by: payload.response_data.responded_by
      })
      .select()
      .single();

    if (responseError) {
      console.error('Error saving response:', responseError);
      throw new Error('Failed to save response');
    }

    console.log('Response saved:', response.id);

    // Atualizar status da cotação
    const { error: updateError } = await supabase
      .from('freight_quotes')
      .update({ 
        status: 'responded', 
        response_received_at: new Date().toISOString() 
      })
      .eq('id', payload.quote_id);

    if (updateError) {
      console.error('Error updating quote status:', updateError);
    }

    // Registrar conversa
    const { error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        order_id: quote.order_id,
        carrier_id: quote.carrier_id,
        quote_id: payload.quote_id,
        conversation_type: 'quote_request',
        message_direction: 'inbound',
        message_content: payload.response_data.raw_message,
        message_metadata: {
          freight_value: payload.response_data.freight_value,
          delivery_time_days: payload.response_data.delivery_time_days,
          carrier_identifier: payload.carrier_identifier
        },
        n8n_message_id: payload.n8n_message_id
      });

    if (conversationError) {
      console.error('Error saving conversation:', conversationError);
    }

    console.log('receive-carrier-response: Successfully processed response');

    return new Response(JSON.stringify({ 
      success: true,
      quote_id: payload.quote_id,
      response_id: response.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('receive-carrier-response: Error:', error);
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
