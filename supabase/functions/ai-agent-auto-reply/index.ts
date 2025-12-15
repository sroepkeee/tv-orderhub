import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoReplyRequest {
  conversation_id: string;
  message_content: string;
  sender_phone: string;
  carrier_id?: string;
  carrier_name?: string;
  order_id?: string;
  contact_type?: string; // 'carrier' | 'customer' | 'unknown'
  customer_id?: string;
}

interface AgentConfig {
  agent_name: string;
  personality: string;
  tone_of_voice: string;
  language: string;
  custom_instructions: string | null;
  signature: string | null;
  auto_reply_enabled: boolean;
  llm_model: string;
  max_response_time_seconds: number;
  human_handoff_keywords: string[];
  auto_reply_delay_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: AutoReplyRequest = await req.json();
    console.log('📨 Auto-reply request:', JSON.stringify(requestData, null, 2));

    const { 
      conversation_id, 
      message_content, 
      sender_phone, 
      carrier_id, 
      carrier_name,
      order_id,
      contact_type = 'carrier',
      customer_id,
    } = requestData;

    console.log('📞 Contact type:', contact_type);

    // 1. Fetch agent configuration
    const { data: config, error: configError } = await supabase
      .from('ai_agent_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config) {
      console.error('❌ Failed to fetch agent config:', configError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent config not found' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentConfig = config as AgentConfig;

    // 2. Check if auto-reply is enabled
    if (!agentConfig.auto_reply_enabled) {
      console.log('⏭️ Auto-reply disabled, skipping');
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'auto_reply_disabled' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Check for human handoff keywords
    const lowerMessage = message_content.toLowerCase();
    const needsHumanHandoff = agentConfig.human_handoff_keywords?.some(
      keyword => lowerMessage.includes(keyword.toLowerCase())
    );

    if (needsHumanHandoff) {
      console.log('🧑 Human handoff triggered, skipping auto-reply');
      
      // Log that human intervention is needed
      await supabase.from('ai_notification_log').insert({
        channel: 'whatsapp',
        recipient: sender_phone,
        message_content: message_content,
        status: 'human_handoff_required',
        metadata: {
          conversation_id,
          carrier_id,
          carrier_name,
          trigger_keywords: agentConfig.human_handoff_keywords.filter(
            k => lowerMessage.includes(k.toLowerCase())
          )
        }
      });

      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'human_handoff_required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch knowledge base for RAG
    console.log('🔍 Searching knowledge base...');
    const queryTokens = message_content.toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 2)
      .slice(0, 10);

    const { data: knowledge } = await supabase
      .from('ai_knowledge_base')
      .select('title, content, category, keywords')
      .eq('is_active', true)
      .limit(5);

    // Score and filter relevant knowledge
    const relevantKnowledge = (knowledge || [])
      .map(item => {
        let score = 0;
        const itemKeywords = item.keywords || [];
        const titleLower = item.title.toLowerCase();
        const contentLower = item.content.toLowerCase();

        for (const token of queryTokens) {
          if (itemKeywords.some((k: string) => k.toLowerCase().includes(token))) score += 10;
          if (titleLower.includes(token)) score += 5;
          if (contentLower.includes(token)) score += 2;
        }
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    console.log(`📚 Found ${relevantKnowledge.length} relevant knowledge items`);

    // 5. Fetch order context if available
    let orderContext = '';
    if (order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, customer_name, status, delivery_date, delivery_address')
        .eq('id', order_id)
        .single();

      if (order) {
        orderContext = `
Contexto do Pedido:
- Número: ${order.order_number}
- Cliente: ${order.customer_name}
- Status: ${order.status}
- Data de Entrega: ${order.delivery_date}
- Endereço: ${order.delivery_address}
`;
      }
    }

    // 5.1 Fetch customer context if contact_type is 'customer'
    let customerContext = '';
    if (contact_type === 'customer' && sender_phone) {
      // Search for customer's recent orders by phone match
      const phoneDigits = sender_phone.replace(/\D/g, '').slice(-8);
      
      const { data: customerOrders } = await supabase
        .from('orders')
        .select('order_number, status, delivery_date, customer_name')
        .or(`customer_document.ilike.%${phoneDigits}%`)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (customerOrders && customerOrders.length > 0) {
        customerContext = `
Pedidos Recentes do Cliente:
${customerOrders.map((o, i) => `${i + 1}. Pedido ${o.order_number} - Status: ${o.status} - Entrega: ${o.delivery_date}`).join('\n')}
`;
      }
    }

    // 6. Build system prompt based on contact type
    const knowledgeContext = relevantKnowledge.length > 0
      ? `\n\nBase de Conhecimento Relevante:\n${relevantKnowledge.map(k => 
          `### ${k.title}\n${k.content}`
        ).join('\n\n')}`
      : '';

    const contactTypeInstructions = contact_type === 'customer' 
      ? `
VOCÊ ESTÁ ATENDENDO UM CLIENTE (não transportadora).
- Seja cordial e prestativo
- Informe sobre status de pedidos se perguntado
- Ofereça ajuda para dúvidas sobre produtos e serviços
- Se não souber o status exato, ofereça verificar com a equipe
${customerContext}
`
      : `
VOCÊ ESTÁ ATENDENDO UMA TRANSPORTADORA.
- Foque em informações logísticas e de frete
- Ajude com cotações e prazos de entrega
- Seja objetivo e profissional
`;

    const systemPrompt = `Você é ${agentConfig.agent_name}, um assistente virtual da IMPLY Tecnologia.

PERSONALIDADE: ${agentConfig.personality}
TOM DE VOZ: ${agentConfig.tone_of_voice}
IDIOMA: ${agentConfig.language}

${agentConfig.custom_instructions || ''}

${contactTypeInstructions}
${orderContext}
${knowledgeContext}

INSTRUÇÕES IMPORTANTES:
1. Responda de forma clara e concisa
2. Mantenha um tom ${agentConfig.tone_of_voice}
3. Se não souber a resposta, ofereça transferir para um atendente humano
4. Use WhatsApp formatting: *negrito*, _itálico_, ~riscado~
5. Não invente informações sobre pedidos ou preços
6. Para cotações de frete, sempre confirme os dados antes de dar valores

${agentConfig.signature ? `\n\nAssinatura: ${agentConfig.signature}` : ''}`;

    // 7. Call OpenAI API
    if (!openaiApiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🤖 Calling OpenAI API with model:', agentConfig.llm_model);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agentConfig.llm_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Mensagem recebida de ${carrier_name || 'contato'} (${sender_phone}):\n\n${message_content}` 
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedMessage = openaiData.choices?.[0]?.message?.content;

    if (!generatedMessage) {
      throw new Error('No response generated from OpenAI');
    }

    console.log('✅ Generated response:', generatedMessage.substring(0, 100) + '...');

    // 8. Send WhatsApp message via Mega API
    const megaApiUrl = Deno.env.get('MEGA_API_URL');
    const megaApiToken = Deno.env.get('MEGA_API_TOKEN');

    if (!megaApiUrl || !megaApiToken) {
      console.error('❌ Mega API credentials not configured');
      // Save the response anyway for manual sending
      await supabase.from('ai_notification_log').insert({
        channel: 'whatsapp',
        recipient: sender_phone,
        message_content: generatedMessage,
        status: 'pending_manual_send',
        metadata: {
          conversation_id,
          carrier_id,
          carrier_name,
          generated_by: 'ai_agent',
          model: agentConfig.llm_model,
          processing_time_ms: Date.now() - startTime,
        }
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: generatedMessage,
        sent: false,
        reason: 'mega_api_not_configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get connected instance
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('status', 'connected')
      .limit(1)
      .single();

    if (!instance) {
      console.warn('⚠️ No connected WhatsApp instance');
      return new Response(JSON.stringify({ 
        success: true,
        message: generatedMessage,
        sent: false,
        reason: 'no_connected_instance'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add delay before sending (more natural)
    if (agentConfig.auto_reply_delay_ms > 0) {
      await new Promise(resolve => setTimeout(resolve, agentConfig.auto_reply_delay_ms));
    }

    // Normalize URL
    let baseUrl = megaApiUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }
    baseUrl = baseUrl.replace(/\/+$/, '');

    // Format phone number
    let formattedPhone = sender_phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }

    const megaApiInstance = instance.instance_key;

    console.log('📤 Using instance:', megaApiInstance);

    // Mega API START usa /rest/sendMessage/{instance}/text
    // Ref: https://apistart02.megaapi.com.br/docs/
    const endpoint = `/rest/sendMessage/${megaApiInstance}/text`;
    const sendUrl = `${baseUrl}${endpoint}`;

    // Mega API START usa header 'apikey'
    const headers = {
      'apikey': megaApiToken,
      'Content-Type': 'application/json',
    };

    // Formato Mega API START: { messageData: { to: "55XXX", text: "...", linkPreview: false } }
    const body = {
      messageData: {
        to: formattedPhone,
        text: generatedMessage,
        linkPreview: false,
      },
    };

    console.log(`📤 Sending to: ${sendUrl}`);
    console.log('📤 Body:', JSON.stringify(body));

    let megaResponse: Response | null = null;
    let megaResponseBody: any = null;
    let lastError = '';

    try {
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log(`📤 Response: ${response.status} - ${responseText.substring(0, 200)}`);

      if (response.ok) {
        megaResponse = response;
        try {
          megaResponseBody = JSON.parse(responseText);
        } catch {
          megaResponseBody = { raw: responseText };
        }
        console.log('✅ Message sent successfully');
      } else {
        lastError = `${response.status}: ${responseText.substring(0, 200)}`;
      }
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      console.error(`❌ Fetch error:`, lastError);
    }


    const messageSent = megaResponse !== null && megaResponse.ok;
    const sendResult = megaResponseBody || { error: lastError };
    
    if (!messageSent) {
      console.error('❌ Failed to send message after trying all endpoints:', lastError);
    }

    // 9. Save outbound message to carrier_conversations
    if (carrier_id) {
      await supabase.from('carrier_conversations').insert({
        carrier_id,
        order_id,
        conversation_type: 'ai_response',
        message_direction: 'outbound',
        message_content: generatedMessage,
        contact_type: 'carrier',
        message_metadata: {
          sent_via: 'ai_agent_auto_reply',
          model: agentConfig.llm_model,
          processing_time_ms: Date.now() - startTime,
          mega_response: sendResult,
        },
        sent_at: new Date().toISOString(),
        delivered_at: messageSent ? new Date().toISOString() : null,
      });
    }

    // 10. Log to ai_notification_log
    await supabase.from('ai_notification_log').insert({
      channel: 'whatsapp',
      recipient: sender_phone,
      message_content: generatedMessage,
      status: messageSent ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
      metadata: {
        conversation_id,
        carrier_id,
        carrier_name,
        order_id,
        generated_by: 'ai_agent',
        model: agentConfig.llm_model,
        processing_time_ms: Date.now() - startTime,
        knowledge_used: relevantKnowledge.map(k => k.title),
        openai_usage: openaiData.usage,
      }
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ Auto-reply completed in ${processingTime}ms, sent: ${messageSent}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: generatedMessage,
      sent: messageSent,
      processing_time_ms: processingTime,
      model: agentConfig.llm_model,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in ai-agent-auto-reply:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
