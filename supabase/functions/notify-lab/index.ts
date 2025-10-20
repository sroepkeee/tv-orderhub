import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyLabRequest {
  orderId: string;
  orderNumber: string;
  items: Array<{
    product: string;
    quantity: number;
    details?: string;
  }>;
  deliveryDate: string;
  priority: string;
  requires_firmware?: boolean;
  firmware_project_name?: string;
  requires_image?: boolean;
  image_project_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId, orderNumber, items, deliveryDate, priority, requires_firmware, firmware_project_name, requires_image, image_project_name } = await req.json() as NotifyLabRequest;

    console.log('Notifying lab about order:', { orderId, orderNumber });

    // Gerar assinatura HMAC para autenticação
    const webhookSecret = Deno.env.get('LAB_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('LAB_WEBHOOK_SECRET not configured');
    }

    const labWebhookUrl = Deno.env.get('LAB_WEBHOOK_URL');
    if (!labWebhookUrl) {
      throw new Error('LAB_WEBHOOK_URL not configured');
    }

    const payload = {
      orderId,
      orderNumber,
      items,
      deliveryDate,
      priority,
      timestamp: new Date().toISOString(),
      special_requirements: {
        requires_firmware: requires_firmware || false,
        firmware_project_name: firmware_project_name || null,
        requires_image: requires_image || false,
        image_project_name: image_project_name || null,
      }
    };

    const payloadString = JSON.stringify(payload);
    
    // Criar assinatura HMAC SHA-256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadString)
    );
    
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Enviar requisição para o laboratório
    const labResponse = await fetch(labWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signatureHex,
      },
      body: payloadString,
    });

    if (!labResponse.ok) {
      const errorText = await labResponse.text();
      console.error('Lab webhook failed:', labResponse.status, errorText);
      throw new Error(`Lab webhook failed: ${labResponse.status}`);
    }

    const labData = await labResponse.json();
    console.log('Lab response:', labData);

    // Registrar no histórico
    const { error: historyError } = await supabaseClient
      .from('order_history')
      .insert({
        order_id: orderId,
        status: 'sent_to_lab',
        changed_by: 'system',
        notes: `Pedido enviado ao laboratório. Ticket ID: ${labData.ticketId || 'N/A'}`,
      });

    if (historyError) {
      console.error('Error saving history:', historyError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        labTicketId: labData.ticketId,
        message: 'Order successfully sent to lab'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-lab function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
