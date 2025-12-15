import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogisticsReplyRequest {
  message: string;
  from_phone: string;
  carrier_id?: string;
  contact_type?: string; // 'carrier' | 'customer'
}

interface OrderContext {
  order: any;
  items: any[];
  trackingEvents: any[];
  occurrences: any[];
  slaStatus: {
    status: string;
    days_remaining: number;
    is_breached: boolean;
  };
}

// Extract order number from message using multiple patterns
function extractOrderNumber(message: string): string | null {
  const patterns = [
    /pedido\s*#?\s*(\d{4,})/i,
    /ordem\s*#?\s*(\d{4,})/i,
    /os\s*#?\s*(\d{4,})/i,
    /#(\d{4,})/,
    /número\s*(\d{4,})/i,
    /nº\s*(\d{4,})/i,
    /n\.\s*(\d{4,})/i,
    /(\d{5,})/, // fallback: 5+ digit number
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Calculate SLA status
function calculateSlaStatus(order: any): { status: string; days_remaining: number; is_breached: boolean } {
  if (!order.sla_deadline && !order.delivery_date) {
    return { status: 'unknown', days_remaining: 0, is_breached: false };
  }

  const deadline = order.sla_deadline || order.delivery_date;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'breached', days_remaining: diffDays, is_breached: true };
  } else if (diffDays <= 2) {
    return { status: 'warning', days_remaining: diffDays, is_breached: false };
  }
  return { status: 'within', days_remaining: diffDays, is_breached: false };
}

// Detect negative sentiment
function detectNegativeSentiment(message: string): boolean {
  const negativePatterns = [
    /absurdo/i, /ridículo/i, /vergonha/i, /péssimo/i,
    /nunca mais/i, /reclamar/i, /procon/i, /advogado/i,
    /processo/i, /inaceitável/i, /indignado/i, /revoltado/i,
    /raiva/i, /ódio/i, /porcaria/i, /lixo/i,
    /mentira/i, /enganar/i, /roubo/i, /fraude/i
  ];
  return negativePatterns.some(p => p.test(message));
}

// Detect financial mention
function containsFinancialMention(message: string): boolean {
  const financialPatterns = [
    /reembolso/i, /estorno/i, /dinheiro/i, /devolver/i,
    /ressarcimento/i, /indenização/i, /prejuízo/i, /perda/i
  ];
  return financialPatterns.some(p => p.test(message));
}

// Translate status to Portuguese
function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pendente',
    'in_transit': 'Em Trânsito',
    'delivered': 'Entregue',
    'collected': 'Coletado',
    'awaiting_pickup': 'Aguardando Coleta',
    'pickup_scheduled': 'Coleta Agendada',
    'in_expedition': 'Em Expedição',
    'released_for_shipping': 'Liberado para Envio',
    'ready_for_shipping': 'Pronto para Envio',
    'invoice_issued': 'Nota Fiscal Emitida',
    'separation_started': 'Separação Iniciada',
    'in_production': 'Em Produção',
    'production_completed': 'Produção Concluída',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    'delayed': 'Atrasado',
  };
  return statusMap[status] || status;
}

// Format date to Brazilian format
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Não definida';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { message, from_phone, carrier_id, contact_type = 'customer' }: LogisticsReplyRequest = await req.json();
    console.log('📦 Logistics Reply - Message:', message, 'From:', from_phone, 'Type:', contact_type);

    // 1. FETCH AGENT CONFIG
    const { data: agentConfig } = await supabase
      .from('ai_agent_config')
      .select('*')
      .eq('agent_type', contact_type)
      .single();

    if (!agentConfig?.is_active) {
      console.log('⚠️ Agent not active for type:', contact_type);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Agent not active',
        shouldReply: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. EXTRACT ORDER NUMBER FROM MESSAGE
    const orderNumber = extractOrderNumber(message);
    console.log('🔍 Extracted order number:', orderNumber);

    let orderContext: OrderContext | null = null;
    let shouldAskForOrder = false;

    if (orderNumber) {
      // 3. FETCH STRUCTURED DATA (Order + Items + Tracking + Occurrences)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*),
          order_tracking_events(*),
          order_occurrences(*)
        `)
        .or(`order_number.eq.${orderNumber},totvs_order_number.eq.${orderNumber}`)
        .single();

      if (order && !orderError) {
        const slaStatus = calculateSlaStatus(order);
        orderContext = {
          order,
          items: order.order_items || [],
          trackingEvents: order.order_tracking_events || [],
          occurrences: order.order_occurrences || [],
          slaStatus
        };
        console.log('✅ Order found:', order.order_number, 'SLA:', slaStatus.status);
      } else {
        console.log('❌ Order not found for number:', orderNumber);
      }
    } else {
      // Check if message seems to be asking about an order
      const orderRelatedPatterns = [
        /onde\s*está/i, /cadê/i, /status/i, /situação/i,
        /entrega/i, /previsão/i, /rastreio/i, /tracking/i
      ];
      shouldAskForOrder = orderRelatedPatterns.some(p => p.test(message));
    }

    // 4. RAG SEARCH - CONTEXTUAL KNOWLEDGE
    let ragContext = '';
    const ragFilters: Record<string, any> = {};

    if (orderContext) {
      // Add contextual filters based on order data
      if (orderContext.order.carrier_name) {
        ragFilters.carrier_name = orderContext.order.carrier_name;
      }
      if (orderContext.occurrences.length > 0) {
        ragFilters.occurrence_type = orderContext.occurrences[0].occurrence_type;
      }
      if (orderContext.slaStatus.is_breached) {
        ragFilters.sla_category = 'fora_sla';
      }
    }

    // Query knowledge base with filters
    let ragQuery = supabase
      .from('ai_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .or(`agent_type.eq.${contact_type},agent_type.eq.general`)
      .order('priority', { ascending: false })
      .limit(5);

    // Apply contextual filters (OR logic to include general docs)
    const { data: ragDocs } = await ragQuery;

    if (ragDocs && ragDocs.length > 0) {
      // Score and filter documents based on context
      const scoredDocs = ragDocs.map(doc => {
        let score = doc.priority || 0;
        
        // Boost if carrier matches
        if (ragFilters.carrier_name && doc.carrier_name === ragFilters.carrier_name) {
          score += 20;
        }
        // Boost if occurrence type matches
        if (ragFilters.occurrence_type && doc.occurrence_type === ragFilters.occurrence_type) {
          score += 15;
        }
        // Boost if SLA category matches
        if (ragFilters.sla_category && doc.sla_category === ragFilters.sla_category) {
          score += 10;
        }
        // Keyword matching
        const messageLower = message.toLowerCase();
        if (doc.keywords?.some((k: string) => messageLower.includes(k.toLowerCase()))) {
          score += 5;
        }

        return { ...doc, relevance_score: score };
      });

      const topDocs = scoredDocs
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 3);

      ragContext = topDocs.map(d => `[${d.category}] ${d.title}:\n${d.content}`).join('\n\n---\n\n');
    }

    // 5. CHECK ESCALATION RULES
    let shouldEscalate = false;
    let escalationReason = '';

    if (orderContext) {
      const { slaStatus, occurrences } = orderContext;

      if (slaStatus.is_breached) {
        shouldEscalate = true;
        escalationReason = 'SLA violado';
      }
      if (occurrences.some((o: any) => o.severity === 'critical' && !o.resolved)) {
        shouldEscalate = true;
        escalationReason = 'Ocorrência crítica';
      }
      if (occurrences.some((o: any) => o.occurrence_type === 'extravio' && !o.resolved)) {
        shouldEscalate = true;
        escalationReason = 'Extravio';
      }
    }

    if (detectNegativeSentiment(message)) {
      shouldEscalate = true;
      escalationReason = 'Sentimento negativo detectado';
    }
    if (containsFinancialMention(message)) {
      shouldEscalate = true;
      escalationReason = 'Menção financeira';
    }

    // Check for human handoff keywords
    const handoffKeywords = agentConfig.human_handoff_keywords || [];
    if (handoffKeywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()))) {
      shouldEscalate = true;
      escalationReason = 'Solicitação de atendimento humano';
    }

    console.log('🚨 Escalation check:', shouldEscalate, escalationReason);

    // 6. BUILD LLM PROMPT
    const systemPrompt = `Você é o ${agentConfig.agent_name}, Agente de Logística da IMPLY Tecnologia.

PAPEL: Atendimento automático de pedidos, envios, atrasos, entregas e SLA.

REGRAS CRÍTICAS:
1. NUNCA invente status, prazos ou ocorrências
2. Use APENAS os dados fornecidos no contexto
3. Se algo não estiver disponível, informe com clareza
4. Seja tranquilizador mas honesto
5. Sempre diga o PRÓXIMO PASSO esperado
6. Se não houver número de pedido, peça educadamente

TOM DE VOZ: ${agentConfig.tone_of_voice}
PERSONALIDADE: ${agentConfig.personality}
IDIOMA: ${agentConfig.language}

FORMATAÇÃO: WhatsApp (*negrito*, _itálico_, emojis moderados)

${agentConfig.custom_instructions || ''}`;

    let userPrompt = '';

    if (shouldAskForOrder && !orderNumber) {
      userPrompt = `MENSAGEM DO CLIENTE:
${message}

O cliente parece estar perguntando sobre um pedido, mas não informou o número.
Responda pedindo o número do pedido de forma educada e prestativa.`;
    } else if (orderContext) {
      const lastEvent = orderContext.trackingEvents
        .sort((a: any, b: any) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())[0];
      
      const activeOccurrences = orderContext.occurrences.filter((o: any) => !o.resolved);

      userPrompt = `DADOS DO PEDIDO:
- Número: ${orderContext.order.order_number}
- Cliente: ${orderContext.order.customer_name}
- Status: ${translateStatus(orderContext.order.status)}
- Transportadora: ${orderContext.order.carrier_name || 'Não definida'}
- Tracking: ${orderContext.order.tracking_code || 'Não disponível'}
- Data de Envio: ${formatDate(orderContext.order.shipping_date)}
- Previsão de Entrega: ${formatDate(orderContext.order.delivery_date)}
- SLA: ${orderContext.slaStatus.days_remaining} dias ${orderContext.slaStatus.days_remaining >= 0 ? 'restantes' : 'em atraso'} (${orderContext.slaStatus.status})
- Itens: ${orderContext.items.length} produto(s)

ÚLTIMO EVENTO DE RASTREIO:
${lastEvent ? `${formatDate(lastEvent.event_datetime)} - ${lastEvent.event_description || lastEvent.event_code} (${lastEvent.location || 'Local não informado'})` : 'Sem eventos de rastreio registrados'}

OCORRÊNCIAS ATIVAS:
${activeOccurrences.length > 0 
  ? activeOccurrences.map((o: any) => `- ${o.occurrence_type}: ${o.description || 'Sem descrição'} (Severidade: ${o.severity})`).join('\n')
  : 'Nenhuma ocorrência ativa'}

DOCUMENTOS LOGÍSTICOS RELEVANTES:
${ragContext || 'Nenhum documento específico encontrado'}

MENSAGEM DO CLIENTE:
${message}

${shouldEscalate 
  ? `⚠️ ATENÇÃO: Este caso requer escalonamento (${escalationReason}). Informe o cliente que um atendente humano entrará em contato em breve.`
  : 'INSTRUÇÕES:\n- Seja objetivo e tranquilizador\n- Explique o que está acontecendo\n- Informe o próximo passo esperado'}`;
    } else if (orderNumber) {
      userPrompt = `MENSAGEM DO CLIENTE:
${message}

O cliente mencionou o pedido número ${orderNumber}, mas este pedido não foi encontrado em nossa base.
Informe educadamente que não encontrou o pedido e peça para confirmar o número.`;
    } else {
      userPrompt = `DOCUMENTOS RELEVANTES:
${ragContext || 'Nenhum documento específico'}

MENSAGEM DO CLIENTE:
${message}

Responda de forma prestativa. Se a pergunta for sobre um pedido específico, peça o número do pedido.`;
    }

    // 7. CALL LLM
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agentConfig.llm_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('❌ LLM Error:', llmResponse.status, errorText);
      throw new Error(`LLM error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    let generatedMessage = llmData.choices?.[0]?.message?.content || '';

    // Add signature if configured
    if (agentConfig.signature && !generatedMessage.includes(agentConfig.signature)) {
      generatedMessage += `\n\n${agentConfig.signature}`;
    }

    console.log('💬 Generated response:', generatedMessage.substring(0, 200));

    // 8. LOG THE INTERACTION
    await supabase
      .from('ai_notification_log')
      .insert({
        channel: 'whatsapp',
        recipient: from_phone,
        message_content: generatedMessage,
        order_id: orderContext?.order?.id,
        status: 'generated',
        metadata: {
          original_message: message,
          order_number: orderNumber,
          contact_type,
          should_escalate: shouldEscalate,
          escalation_reason: escalationReason,
          rag_docs_used: ragDocs?.length || 0,
          sla_status: orderContext?.slaStatus,
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: generatedMessage,
      orderFound: !!orderContext,
      orderNumber,
      shouldEscalate,
      escalationReason,
      slaStatus: orderContext?.slaStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Logistics Reply Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
