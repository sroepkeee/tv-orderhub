import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryIntent {
  type: 'order_status' | 'daily_summary' | 'delayed_orders' | 'orders_by_phase' | 'top_orders' | 'search_customer' | 'help' | 'general';
  params: Record<string, any>;
}

// Detectar intenção da mensagem do gestor
function detectManagerIntent(message: string): QueryIntent {
  const messageLower = message.toLowerCase().trim();

  // Status de pedido específico
  const orderMatch = messageLower.match(/(?:status|pedido|order)\s*#?\s*(\d+)/i) ||
                     messageLower.match(/#?\s*(\d+)\s*(?:status)?/i);
  if (orderMatch) {
    return { type: 'order_status', params: { orderNumber: orderMatch[1] } };
  }

  // Resumo do dia
  if (messageLower.includes('resumo') || messageLower.includes('dashboard') || 
      messageLower.includes('hoje') || messageLower.includes('dia')) {
    return { type: 'daily_summary', params: {} };
  }

  // Pedidos atrasados
  if (messageLower.includes('atrasad') || messageLower.includes('atraso') || 
      messageLower.includes('delay') || messageLower.includes('vencid')) {
    return { type: 'delayed_orders', params: {} };
  }

  // Pedidos por fase
  const phaseKeywords: Record<string, string[]> = {
    'production_client': ['produção', 'producao', 'em produção', 'em producao', 'production'],
    'packaging': ['embalagem', 'embalando', 'packaging'],
    'logistics': ['expedição', 'expedicao', 'logística', 'logistica', 'logistics'],
    'invoicing': ['faturamento', 'faturar', 'fatura', 'nf', 'nota fiscal', 'invoice'],
    'laboratory': ['laboratório', 'laboratorio', 'lab'],
    'freight_quote': ['frete', 'cotação', 'cotacao', 'freight'],
    'in_transit': ['trânsito', 'transito', 'em transporte', 'in_transit'],
  };

  for (const [phase, keywords] of Object.entries(phaseKeywords)) {
    if (keywords.some(kw => messageLower.includes(kw))) {
      return { type: 'orders_by_phase', params: { phase } };
    }
  }

  // Top pedidos por valor
  if (messageLower.includes('maior') || messageLower.includes('top') || 
      messageLower.includes('valor') || messageLower.includes('grandes')) {
    return { type: 'top_orders', params: { limit: 5 } };
  }

  // Buscar cliente
  const customerMatch = messageLower.match(/(?:cliente|customer)\s+(.+)/i);
  if (customerMatch) {
    return { type: 'search_customer', params: { customerName: customerMatch[1].trim() } };
  }

  // Ajuda
  if (messageLower.includes('ajuda') || messageLower.includes('help') || 
      messageLower === 'comandos' || messageLower === '?') {
    return { type: 'help', params: {} };
  }

  return { type: 'general', params: { query: message } };
}

// Buscar detalhes de um pedido específico
async function getOrderDetails(supabase: any, orderNumber: string): Promise<string> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, status, delivery_date, 
      total_value, notes, created_at, freight_type, destination_city, destination_state,
      order_items(id, item_code, item_description, requested_quantity, delivered_quantity, item_status, delivery_date)
    `)
    .or(`order_number.ilike.%${orderNumber}%,order_number.eq.${orderNumber}`)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    return `❌ Pedido #${orderNumber} não encontrado.`;
  }

  const items = order.order_items || [];
  const itemsCount = items.length;
  const totalValue = order.total_value ? `R$ ${Number(order.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado';
  
  // Calcular dias até entrega
  const deliveryDate = order.delivery_date ? new Date(order.delivery_date) : null;
  const today = new Date();
  const daysUntilDelivery = deliveryDate ? Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  let slaStatus = '⏳';
  if (daysUntilDelivery !== null) {
    if (daysUntilDelivery < 0) slaStatus = '🔴 Atrasado';
    else if (daysUntilDelivery === 0) slaStatus = '🟡 Vence hoje';
    else if (daysUntilDelivery <= 2) slaStatus = '🟡 Crítico';
    else slaStatus = '🟢 No prazo';
  }

  // Status traduzido
  const statusLabels: Record<string, string> = {
    'in_production': '🔧 Em Produção',
    'separation_started': '📦 Separação Iniciada',
    'production_completed': '✅ Produção Concluída',
    'in_packaging': '📦 Em Embalagem',
    'ready_for_shipping': '🚚 Pronto para Envio',
    'in_transit': '🚛 Em Trânsito',
    'delivered': '✅ Entregue',
    'awaiting_lab': '🔬 Aguardando Lab',
    'in_lab_analysis': '🔬 Em Análise Lab',
    'invoice_requested': '💳 NF Solicitada',
    'invoice_issued': '💳 NF Emitida',
    'freight_quote_requested': '💰 Cotação Solicitada',
    'freight_approved': '💰 Frete Aprovado',
  };

  const statusText = statusLabels[order.status] || order.status;

  let response = `📦 *Pedido #${order.order_number}*
━━━━━━━━━━━━━━━━━━
👤 Cliente: ${order.customer_name}
📍 Status: ${statusText}
📅 Previsão: ${deliveryDate ? deliveryDate.toLocaleDateString('pt-BR') : 'Não definida'}
💰 Valor: ${totalValue}
${slaStatus}

📋 *Itens (${itemsCount}):*`;

  items.slice(0, 5).forEach((item: any) => {
    response += `\n• ${item.requested_quantity}x ${item.item_code}`;
    if (item.item_description) {
      response += ` - ${item.item_description.substring(0, 30)}`;
    }
  });

  if (items.length > 5) {
    response += `\n... e mais ${items.length - 5} itens`;
  }

  if (order.destination_city) {
    response += `\n\n🚚 Destino: ${order.destination_city}${order.destination_state ? `/${order.destination_state}` : ''}`;
  }

  if (order.freight_type) {
    response += `\n📦 Frete: ${order.freight_type}`;
  }

  return response;
}

// Gerar resumo do dia
async function getDailySummary(supabase: any): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Buscar pedidos ativos
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date, created_at')
    .not('status', 'in', '("completed","cancelled","delivered")');

  const activeOrders = orders || [];
  const totalValue = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.total_value) || 0), 0);

  // Contar por fase
  const phaseCount: Record<string, number> = {};
  const phaseMap: Record<string, string> = {
    'in_production': 'Produção',
    'separation_started': 'Produção',
    'production_completed': 'Produção',
    'awaiting_material': 'Produção',
    'separation_completed': 'Produção',
    'in_packaging': 'Embalagem',
    'ready_for_shipping': 'Embalagem',
    'in_quality_check': 'Embalagem',
    'in_transit': 'Transporte',
    'collected': 'Transporte',
    'awaiting_lab': 'Laboratório',
    'in_lab_analysis': 'Laboratório',
    'lab_completed': 'Laboratório',
    'invoice_requested': 'Faturamento',
    'awaiting_invoice': 'Faturamento',
    'invoice_issued': 'Faturamento',
    'invoice_sent': 'Faturamento',
    'freight_quote_requested': 'Cotação',
    'freight_quote_received': 'Cotação',
    'freight_approved': 'Cotação',
    'released_for_shipping': 'Expedição',
    'in_expedition': 'Expedição',
    'pickup_scheduled': 'Expedição',
    'awaiting_pickup': 'Expedição',
  };

  activeOrders.forEach((order: any) => {
    const phase = phaseMap[order.status] || 'Outros';
    phaseCount[phase] = (phaseCount[phase] || 0) + 1;
  });

  // Contar atrasados
  const delayedCount = activeOrders.filter((o: any) => {
    if (!o.delivery_date) return false;
    return new Date(o.delivery_date) < new Date();
  }).length;

  // Pedidos novos hoje
  const newToday = activeOrders.filter((o: any) => {
    const createdDate = new Date(o.created_at);
    return createdDate >= today;
  }).length;

  let response = `📊 *Resumo do Dia - ${today.toLocaleDateString('pt-BR')}*
━━━━━━━━━━━━━━━━━━
📦 Pedidos Ativos: ${activeOrders.length}
💰 Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
🆕 Novos Hoje: ${newToday}

*Por Fase:*`;

  // Ordenar fases por quantidade
  const sortedPhases = Object.entries(phaseCount).sort((a, b) => b[1] - a[1]);
  sortedPhases.forEach(([phase, count]) => {
    const emoji = phase === 'Produção' ? '🔧' : 
                  phase === 'Embalagem' ? '📦' : 
                  phase === 'Transporte' ? '🚛' :
                  phase === 'Laboratório' ? '🔬' :
                  phase === 'Faturamento' ? '💳' :
                  phase === 'Cotação' ? '💰' :
                  phase === 'Expedição' ? '📤' : '📋';
    response += `\n${emoji} ${phase}: ${count}`;
  });

  response += `\n\n⚠️ *Alertas:*
• ${delayedCount} pedidos atrasados`;

  // Pedidos com entrega para hoje
  const todayDeliveries = activeOrders.filter((o: any) => {
    if (!o.delivery_date) return false;
    const deliveryDate = new Date(o.delivery_date);
    return deliveryDate.toDateString() === today.toDateString();
  }).length;

  if (todayDeliveries > 0) {
    response += `\n• ${todayDeliveries} entregas previstas para hoje`;
  }

  return response;
}

// Buscar pedidos atrasados
async function getDelayedOrders(supabase: any): Promise<string> {
  const today = new Date();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .lt('delivery_date', today.toISOString().split('T')[0])
    .order('delivery_date', { ascending: true })
    .limit(10);

  if (!orders || orders.length === 0) {
    return '✅ Nenhum pedido atrasado no momento!';
  }

  let response = `⚠️ *Pedidos Atrasados (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  let totalDelayed = 0;
  orders.forEach((order: any, index: number) => {
    const deliveryDate = new Date(order.delivery_date);
    const daysLate = Math.ceil((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    const value = order.total_value ? Number(order.total_value) : 0;
    totalDelayed += value;

    response += `

${index + 1}️⃣ *#${order.order_number}* - ${order.customer_name.substring(0, 25)}
   📍 ${order.status} | ⏱️ ${daysLate} dia${daysLate > 1 ? 's' : ''} atraso
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  response += `

💰 Total em atraso: R$ ${totalDelayed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Buscar pedidos por fase
async function getOrdersByPhase(supabase: any, phase: string): Promise<string> {
  const statusMap: Record<string, string[]> = {
    'production_client': ['in_production', 'separation_started', 'awaiting_material', 'separation_completed', 'production_completed'],
    'packaging': ['in_quality_check', 'in_packaging', 'ready_for_shipping'],
    'logistics': ['released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup'],
    'invoicing': ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'],
    'laboratory': ['awaiting_lab', 'in_lab_analysis', 'lab_completed'],
    'freight_quote': ['freight_quote_requested', 'freight_quote_received', 'freight_approved'],
    'in_transit': ['in_transit', 'collected'],
  };

  const phaseLabels: Record<string, string> = {
    'production_client': '🔧 Produção',
    'packaging': '📦 Embalagem',
    'logistics': '📤 Expedição',
    'invoicing': '💳 Faturamento',
    'laboratory': '🔬 Laboratório',
    'freight_quote': '💰 Cotação de Frete',
    'in_transit': '🚛 Em Trânsito',
  };

  const statuses = statusMap[phase] || [];
  if (statuses.length === 0) {
    return `❌ Fase "${phase}" não reconhecida.`;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .in('status', statuses)
    .order('delivery_date', { ascending: true })
    .limit(15);

  if (!orders || orders.length === 0) {
    return `✅ Nenhum pedido em ${phaseLabels[phase] || phase} no momento.`;
  }

  const phaseLabel = phaseLabels[phase] || phase;
  let response = `${phaseLabel} *Pedidos (${orders.length})*
━━━━━━━━━━━━━━━━━━`;

  orders.forEach((order: any, index: number) => {
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';
    const value = order.total_value ? `R$ ${Number(order.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

    response += `
${index + 1}. *#${order.order_number}* - ${order.customer_name.substring(0, 20)}
   📅 ${deliveryDate} ${value ? `| ${value}` : ''}`;
  });

  return response;
}

// Buscar top pedidos por valor
async function getTopOrders(supabase: any, limit: number): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .not('status', 'in', '("completed","cancelled","delivered")')
    .not('total_value', 'is', null)
    .order('total_value', { ascending: false })
    .limit(limit);

  if (!orders || orders.length === 0) {
    return '❌ Nenhum pedido ativo encontrado.';
  }

  let response = `💰 *Top ${limit} Maiores Pedidos*
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  orders.forEach((order: any, index: number) => {
    const value = Number(order.total_value) || 0;
    total += value;
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';

    response += `

${index + 1}️⃣ *#${order.order_number}*
   👤 ${order.customer_name.substring(0, 25)}
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   📅 ${deliveryDate}`;
  });

  response += `

━━━━━━━━━━━━━━━━━━
💰 Total Top ${limit}: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Buscar pedidos por cliente
async function searchByCustomer(supabase: any, customerName: string): Promise<string> {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_value, delivery_date')
    .ilike('customer_name', `%${customerName}%`)
    .not('status', 'in', '("completed","cancelled","delivered")')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return `❌ Nenhum pedido ativo encontrado para cliente "${customerName}".`;
  }

  let response = `👤 *Pedidos do Cliente "${customerName}"* (${orders.length})
━━━━━━━━━━━━━━━━━━`;

  let total = 0;
  orders.forEach((order: any, index: number) => {
    const value = Number(order.total_value) || 0;
    total += value;
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'S/D';

    response += `

${index + 1}. *#${order.order_number}*
   📍 ${order.status} | 📅 ${deliveryDate}
   💰 R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  response += `

💰 Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return response;
}

// Mensagem de ajuda
function getHelpMessage(): string {
  return `📖 *Comandos Disponíveis*
━━━━━━━━━━━━━━━━━━

📦 *Status de Pedido:*
• "status 12345" ou "#12345"

📊 *Resumo do Dia:*
• "resumo" ou "dashboard" ou "hoje"

⚠️ *Pedidos Atrasados:*
• "atrasados" ou "atraso"

🔧 *Pedidos por Fase:*
• "pedidos em produção"
• "pedidos em expedição"
• "pedidos em faturamento"
• "pedidos em laboratório"

💰 *Maiores Pedidos:*
• "top pedidos" ou "maiores"

👤 *Buscar Cliente:*
• "cliente NOME"

❓ *Ajuda:*
• "ajuda" ou "comandos"`;
}

// Processar consulta com IA para casos gerais
async function processWithAI(supabase: any, query: string): Promise<string> {
  // Para consultas gerais, tentar responder com ajuda ou processar com IA
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return getHelpMessage() + '\n\n_Digite um comando acima ou faça uma pergunta específica._';
  }

  try {
    // Buscar alguns dados para contexto
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('order_number, customer_name, status')
      .not('status', 'in', '("completed","cancelled")')
      .limit(5);

    const context = recentOrders?.map((o: any) => `#${o.order_number} - ${o.customer_name} (${o.status})`).join('\n') || 'Nenhum pedido recente';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é o Assistente Gerencial da IMPLY. Responda de forma concisa e use formatação WhatsApp (*negrito*, _itálico_).
            
Pedidos recentes:
${context}

Se não souber a resposta, sugira usar os comandos: "resumo", "atrasados", "status NUMERO", "produção", "cliente NOME".`
          },
          { role: 'user', content: query }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return getHelpMessage();
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || getHelpMessage();
  } catch (error) {
    console.error('AI processing error:', error);
    return getHelpMessage();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, senderPhone, carrierId } = await req.json();

    console.log('🔍 Manager query received:', { message, senderPhone });

    // Detectar intenção
    const intent = detectManagerIntent(message);
    console.log('📊 Detected intent:', intent);

    let responseMessage: string;

    switch (intent.type) {
      case 'order_status':
        responseMessage = await getOrderDetails(supabase, intent.params.orderNumber);
        break;
      case 'daily_summary':
        responseMessage = await getDailySummary(supabase);
        break;
      case 'delayed_orders':
        responseMessage = await getDelayedOrders(supabase);
        break;
      case 'orders_by_phase':
        responseMessage = await getOrdersByPhase(supabase, intent.params.phase);
        break;
      case 'top_orders':
        responseMessage = await getTopOrders(supabase, intent.params.limit || 5);
        break;
      case 'search_customer':
        responseMessage = await searchByCustomer(supabase, intent.params.customerName);
        break;
      case 'help':
        responseMessage = getHelpMessage();
        break;
      default:
        responseMessage = await processWithAI(supabase, message);
    }

    // Enviar resposta via Mega API
    const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';

    // Buscar instância conectada
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (instance?.instance_key) {
      let normalizedUrl = megaApiUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      normalizedUrl = normalizedUrl.replace(/\/+$/, '');

      let formattedPhone = senderPhone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      const sendUrl = `${normalizedUrl}/rest/sendMessage/${instance.instance_key}/text`;
      const body = {
        messageData: {
          to: formattedPhone,
          text: responseMessage,
          linkPreview: false,
        }
      };

      console.log('📤 Sending manager response to:', formattedPhone);

      const sendResponse = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': megaApiToken,
        },
        body: JSON.stringify(body),
      });

      if (sendResponse.ok) {
        console.log('✅ Manager response sent successfully');

        // Salvar conversa se temos carrierId
        if (carrierId) {
          // Salvar pergunta do gestor
          await supabase.from('carrier_conversations').insert({
            carrier_id: carrierId,
            conversation_type: 'general',
            message_direction: 'inbound',
            message_content: message,
            contact_type: 'manager',
            message_metadata: { intent: intent.type },
          });

          // Salvar resposta do sistema
          await supabase.from('carrier_conversations').insert({
            carrier_id: carrierId,
            conversation_type: 'general',
            message_direction: 'outbound',
            message_content: responseMessage,
            contact_type: 'manager',
            message_metadata: { sent_via: 'manager_query', intent: intent.type },
            sent_at: new Date().toISOString(),
          });
        }
      } else {
        console.error('❌ Failed to send manager response:', await sendResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        intent: intent.type,
        response: responseMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-agent-manager-query:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
