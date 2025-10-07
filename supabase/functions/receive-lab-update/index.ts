import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

interface LabUpdateRequest {
  orderId: string;
  orderNumber: string;
  status: 'in_production' | 'quality_check' | 'ready' | 'error';
  progress?: number;
  notes?: string;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar assinatura do webhook
    const signature = req.headers.get('X-Webhook-Signature');
    if (!signature) {
      console.error('Missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookSecret = Deno.env.get('LAB_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('LAB_WEBHOOK_SECRET not configured');
    }

    const bodyText = await req.text();
    
    // Validar assinatura HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(bodyText)
    );

    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(bodyText) as LabUpdateRequest;
    console.log('Received lab update:', data);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mapear status do laboratório para status do sistema
    const statusMapping: Record<string, string> = {
      'in_production': 'in_production',
      'quality_check': 'quality_check',
      'ready': 'ready',
      'error': 'production_error',
    };

    const newStatus = statusMapping[data.status] || data.status;

    // Atualizar o pedido
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }

    // Registrar no histórico
    const { error: historyError } = await supabaseClient
      .from('order_history')
      .insert({
        order_id: data.orderId,
        status: newStatus,
        changed_by: 'lab_system',
        notes: data.notes || `Status atualizado pelo laboratório: ${data.status}`,
      });

    if (historyError) {
      console.error('Error saving history:', historyError);
    }

    // Se houver progresso, adicionar comentário
    if (data.progress !== undefined) {
      const { error: commentError } = await supabaseClient
        .from('order_comments')
        .insert({
          order_id: data.orderId,
          user_id: '00000000-0000-0000-0000-000000000000', // Sistema
          comment: `Progresso de produção: ${data.progress}%${data.notes ? ` - ${data.notes}` : ''}`,
        });

      if (commentError) {
        console.error('Error saving comment:', commentError);
      }
    }

    console.log('Order updated successfully:', data.orderId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Update received and processed',
        orderId: data.orderId,
        newStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in receive-lab-update function:', error);
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
