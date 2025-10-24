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

      try {
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

        // Atualizar status da cotação
        await supabase
          .from('freight_quotes')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            n8n_conversation_id: n8nData.conversation_id || n8nData.id
          })
          .eq('id', quote.id);

        // Registrar conversa
        await supabase
          .from('carrier_conversations')
          .insert({
            order_id: orderId,
            carrier_id: carrierId,
            quote_id: quote.id,
            conversation_type: 'quote_request',
            message_direction: 'outbound',
            message_content: JSON.stringify(quoteData, null, 2),
            message_metadata: {
              channel: carrier.whatsapp ? 'whatsapp' : 'email',
              recipient: carrier.quote_email || carrier.email
            },
            n8n_message_id: n8nData.message_id,
            created_by: userId
          });

        results.push({ 
          quote_id: quote.id,
          carrier_id: carrierId,
          carrier_name: carrier.name,
          status: 'sent'
        });
      } catch (n8nError) {
        console.error(`Error sending to N8N for carrier ${carrierId}:`, n8nError);
        
        // Reverter status para pending
        await supabase
          .from('freight_quotes')
          .update({ status: 'pending' })
          .eq('id', quote.id);

        results.push({ 
          carrier_id: carrierId,
          carrier_name: carrier.name,
          status: 'error', 
          error: 'Failed to send via N8N' 
        });
      }
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
