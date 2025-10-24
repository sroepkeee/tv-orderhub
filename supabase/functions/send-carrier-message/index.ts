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

function formatCompleteOrderMessage(order: any, items: any[], userMessage: string): string {
  const lines: string[] = [];
  
  // Mensagem do usuário no topo
  if (userMessage) {
    lines.push(userMessage);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
  }
  
  // Dados do Pedido
  lines.push('📋 *DADOS DO PEDIDO*');
  lines.push(`Pedido: ${order.order_number || 'N/A'}`);
  if (order.totvs_order_number) {
    lines.push(`Pedido TOTVS: ${order.totvs_order_number}`);
  }
  if (order.issue_date) {
    lines.push(`Data Emissão: ${new Date(order.issue_date).toLocaleDateString('pt-BR')}`);
  }
  if (order.delivery_date) {
    lines.push(`Data Entrega: ${new Date(order.delivery_date).toLocaleDateString('pt-BR')}`);
  }
  lines.push('');
  
  // Dados do Destinatário
  lines.push('👤 *DESTINATÁRIO*');
  lines.push(`Nome: ${order.customer_name || 'N/A'}`);
  if (order.customer_document) {
    lines.push(`Documento: ${order.customer_document}`);
  }
  if (order.delivery_address) {
    lines.push(`Endereço: ${order.delivery_address}`);
  }
  if (order.municipality) {
    lines.push(`Município: ${order.municipality}`);
  }
  lines.push('');
  
  // Dados da Carga
  if (items && items.length > 0) {
    lines.push('📦 *ITENS DO PEDIDO*');
    let totalWeight = 0;
    let totalValue = 0;
    
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.item_description || 'Item'}`);
      lines.push(`   Código: ${item.item_code || 'N/A'}`);
      lines.push(`   Quantidade: ${item.requested_quantity || 0} ${item.unit || 'UND'}`);
      if (item.unit_price) {
        lines.push(`   Valor Unit.: R$ ${parseFloat(item.unit_price).toFixed(2)}`);
      }
      if (item.total_value) {
        const itemTotal = parseFloat(item.total_value);
        lines.push(`   Valor Total: R$ ${itemTotal.toFixed(2)}`);
        totalValue += itemTotal;
      }
      lines.push('');
    });
    
    lines.push(`Total de Itens: ${items.length}`);
    if (totalValue > 0) {
      lines.push(`Valor Total da Carga: R$ ${totalValue.toFixed(2)}`);
    }
    lines.push('');
  }
  
  // Dados do Frete
  lines.push('🚚 *INFORMAÇÕES DE FRETE*');
  if (order.freight_type) {
    lines.push(`Tipo de Frete: ${order.freight_type}`);
  }
  if (order.freight_modality) {
    lines.push(`Modalidade: ${order.freight_modality}`);
  }
  if (order.carrier_name) {
    lines.push(`Transportadora: ${order.carrier_name}`);
  }
  lines.push('');
  
  // Dimensões e Peso
  lines.push('📏 *DIMENSÕES E PESO*');
  if (order.package_weight_kg) {
    lines.push(`Peso: ${order.package_weight_kg} kg`);
  }
  if (order.package_volumes) {
    lines.push(`Volumes: ${order.package_volumes}`);
  }
  if (order.package_length_m || order.package_width_m || order.package_height_m) {
    const dims = [
      order.package_length_m ? `${order.package_length_m}m` : null,
      order.package_width_m ? `${order.package_width_m}m` : null,
      order.package_height_m ? `${order.package_height_m}m` : null
    ].filter(Boolean).join(' x ');
    if (dims) {
      lines.push(`Dimensões: ${dims}`);
    }
  }
  
  // Observações
  if (order.notes) {
    lines.push('');
    lines.push('📝 *OBSERVAÇÕES*');
    lines.push(order.notes);
  }
  
  return lines.join('\n');
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

    // Buscar dados completos do pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      throw new Error('Order not found');
    }

    // Buscar itens do pedido
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
    }

    // Formatar mensagem completa com todas as informações
    const fullMessage = formatCompleteOrderMessage(order, orderItems || [], message);

    // Preparar payload para N8N com informações completas
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
      order_details: {
        order_number: order.order_number,
        totvs_order_number: order.totvs_order_number,
        issue_date: order.issue_date,
        delivery_date: order.delivery_date,
        customer_name: order.customer_name,
        customer_document: order.customer_document,
        delivery_address: order.delivery_address,
        municipality: order.municipality,
        freight_type: order.freight_type,
        freight_modality: order.freight_modality,
        package_weight_kg: order.package_weight_kg,
        package_volumes: order.package_volumes,
        package_length_m: order.package_length_m,
        package_width_m: order.package_width_m,
        package_height_m: order.package_height_m,
        notes: order.notes
      },
      items: orderItems?.map(item => ({
        item_code: item.item_code,
        description: item.item_description,
        quantity: item.requested_quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_value: item.total_value
      })),
      message: fullMessage
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

    // Registrar conversa com informações completas
    const { data: conversation, error: conversationError } = await supabase
      .from('carrier_conversations')
      .insert({
        order_id: orderId,
        carrier_id: carrierId,
        quote_id: quoteId || null,
        conversation_type: conversationType,
        message_direction: 'outbound',
        message_content: fullMessage,
        message_metadata: {
          channel: carrier.whatsapp ? 'whatsapp' : 'email',
          recipient: carrier.email,
          order_details: n8nPayload.order_details,
          items_count: orderItems?.length || 0
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
