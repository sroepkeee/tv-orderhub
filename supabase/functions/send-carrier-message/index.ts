import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  carrierId: string;
  orderId: string;
  quoteId?: string;
  message: string;
  conversationType: 'follow_up' | 'negotiation' | 'general';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('send-carrier-message: Processing request');
    
    const { carrierId, orderId, quoteId, message, conversationType }: SendMessageRequest = await req.json();
    
    if (!carrierId || !orderId || !message || !conversationType) {
      throw new Error('Missing required fields: carrierId, orderId, message, conversationType');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL')!;
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

    // Buscar dados da transportadora
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('*')
      .eq('id', carrierId)
      .single();

    if (carrierError || !carrier) {
      console.error('Carrier not found:', carrierError);
      throw new Error('Carrier not found');
    }

    // Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      throw new Error('Order not found');
    }

    // Preparar payload para N8N
    const n8nPayload = {
      message_type: conversationType,
      order_id: orderId,
      order_number: order.order_number,
      quote_id: quoteId,
      carrier: {
        id: carrier.id,
        name: carrier.name,
        email: carrier.email,
        whatsapp: carrier.whatsapp,
        contact_person: carrier.contact_person
      },
      message: message
    };

    // Enviar para N8N
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

    if (!n8nResponse.ok) {
      throw new Error(`N8N returned status ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json();
    console.log('N8N response:', n8nData);

    // Registrar conversa
    const { data: conversation, error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        order_id: orderId,
        carrier_id: carrierId,
        quote_id: quoteId || null,
        conversation_type: conversationType,
        message_direction: 'outbound',
        message_content: message,
        message_metadata: {
          channel: carrier.whatsapp ? 'whatsapp' : 'email',
          recipient: carrier.email
        },
        n8n_message_id: n8nData.message_id || n8nData.id,
        created_by: userId
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error saving conversation:', conversationError);
      throw new Error('Failed to save conversation');
    }

    console.log('send-carrier-message: Successfully sent message');

    return new Response(JSON.stringify({ 
      success: true,
      message_id: conversation.id,
      n8n_message_id: n8nData.message_id || n8nData.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('send-carrier-message: Error:', error);
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
