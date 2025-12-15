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

    // 4. EXTRACT ORDER NUMBER FROM MESSAGE
    console.log('🔍 Extracting order number from message...');
    const orderPatterns = [
      /pedido\s*(?:n[°º]?|numero|#)?\s*[:\-]?\s*(\d{4,})/i,
      /ordem\s*(?:n[°º]?|numero|#)?\s*[:\-]?\s*(\d{4,})/i,
      /n[°º]?\s*(\d{5,})/i,
      /#\s*(\d{4,})/,
      /\b(\d{6})\b/,  // 6+ digits as order number
    ];
    
    let extractedOrderNumber: string | null = null;
    for (const pattern of orderPatterns) {
      const match = message_content.match(pattern);
      if (match) {
        extractedOrderNumber = match[1];
        console.log(`📦 Extracted order number: ${extractedOrderNumber}`);
        break;
      }
    }

    // 5. LOOKUP ORDER IN DATABASE (with sensitive data filtering)
    let orderContext = '';
    let foundOrder: any = null;

    // Helper function to translate status to Portuguese
    const translateStatus = (status: string): string => {
      const statusLabels: Record<string, string> = {
        'almox_ssm_pending': 'Aguardando Almoxarifado SSM',
        'almox_ssm_received': 'Recebido Almox SSM',
        'order_generation_pending': 'Aguardando Geração de Ordem',
        'order_in_creation': 'Ordem em Criação',
        'order_generated': 'Ordem Gerada',
        'almox_general_received': 'Recebido Almox Geral',
        'almox_general_separating': 'Em Separação',
        'almox_general_ready': 'Pronto para Produção',
        'separation_started': 'Separação Iniciada',
        'in_production': 'Em Produção',
        'awaiting_material': 'Aguardando Material',
        'separation_completed': 'Separação Concluída',
        'production_completed': 'Produção Concluída',
        'awaiting_lab': 'Aguardando Laboratório',
        'in_lab_analysis': 'Em Análise no Laboratório',
        'lab_completed': 'Laboratório Concluído',
        'in_quality_check': 'Em Verificação de Qualidade',
        'in_packaging': 'Em Embalagem',
        'ready_for_shipping': 'Pronto para Expedição',
        'freight_quote_requested': 'Cotação de Frete Solicitada',
        'freight_quote_received': 'Cotação de Frete Recebida',
        'freight_approved': 'Frete Aprovado',
        'ready_to_invoice': 'Pronto para Faturar',
        'invoice_requested': 'Faturamento Solicitado',
        'awaiting_invoice': 'Aguardando Fatura',
        'invoice_issued': 'Nota Fiscal Emitida',
        'invoice_sent': 'Nota Fiscal Enviada',
        'released_for_shipping': 'Liberado para Expedição',
        'in_expedition': 'Em Expedição',
        'pickup_scheduled': 'Coleta Agendada',
        'awaiting_pickup': 'Aguardando Coleta',
        'in_transit': 'Em Trânsito',
        'collected': 'Coletado',
        'delivered': 'Entregue',
        'completed': 'Concluído',
        'cancelled': 'Cancelado',
      };
      return statusLabels[status] || status;
    };

    // Helper function to format date
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return 'Não definida';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    // Try to find order by extracted number
    if (extractedOrderNumber) {
      console.log(`🔍 Searching for order: ${extractedOrderNumber}`);
      const { data: order } = await supabase
        .from('orders')
        .select(`
          order_number,
          totvs_order_number,
          status,
          delivery_date,
          carrier_name,
          tracking_code,
          customer_name,
          municipality
        `)
        .or(`order_number.eq.${extractedOrderNumber},totvs_order_number.eq.${extractedOrderNumber}`)
        .limit(1)
        .single();

      if (order) {
        foundOrder = order;
        console.log(`✅ Found order: ${order.order_number}`);
      }
    }

    // If no order found by number, try by order_id or customer context
    if (!foundOrder && order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select(`
          order_number,
          totvs_order_number,
          status,
          delivery_date,
          carrier_name,
          tracking_code,
          customer_name,
          municipality
        `)
        .eq('id', order_id)
        .single();

      if (order) {
        foundOrder = order;
      }
    }

    // If customer contact, try to find their last order
    if (!foundOrder && contact_type === 'customer' && sender_phone) {
      const phoneDigits = sender_phone.replace(/\D/g, '').slice(-8);
      
      // Search by customer_contacts.last_order_id
      const { data: customerContact } = await supabase
        .from('customer_contacts')
        .select('last_order_id, customer_name')
        .or(`whatsapp.ilike.%${phoneDigits}%,phone.ilike.%${phoneDigits}%`)
        .limit(1)
        .single();

      if (customerContact?.last_order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select(`
            order_number,
            totvs_order_number,
            status,
            delivery_date,
            carrier_name,
            tracking_code,
            customer_name,
            municipality
          `)
          .eq('id', customerContact.last_order_id)
          .single();

        if (order) {
          foundOrder = order;
        }
      }
    }

    // Build order context with FILTERED information (no sensitive data)
    if (foundOrder) {
      orderContext = `
📦 DADOS DO PEDIDO ENCONTRADO:
Pedido: *${foundOrder.order_number}*
Status: ${translateStatus(foundOrder.status)}
Entrega: ${formatDate(foundOrder.delivery_date)}
Transportadora: ${foundOrder.carrier_name || 'Pendente'}
Rastreio: ${foundOrder.tracking_code || 'Aguardando'}
Destino: ${foundOrder.municipality || '-'}

⚠️ NÃO revele: valores, CPF/CNPJ, endereço completo, dados bancários.
`;
    }

    // 6. Fetch knowledge base for RAG
    console.log('🔍 Searching knowledge base...');
    const queryTokens = message_content.toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 2)
      .slice(0, 10);

    const { data: knowledge } = await supabase
      .from('ai_knowledge_base')
      .select('title, content, category, keywords, carrier_name, occurrence_type, sla_category')
      .eq('is_active', true)
      .or(`agent_type.eq.${contact_type},agent_type.eq.general`)
      .limit(10);

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
        
        // Boost if carrier matches
        if (foundOrder?.carrier_name && item.carrier_name) {
          if (foundOrder.carrier_name.toLowerCase().includes(item.carrier_name.toLowerCase())) {
            score += 15;
          }
        }
        
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    console.log(`📚 Found ${relevantKnowledge.length} relevant knowledge items`);

    // 7. Build system prompt based on contact type
    const knowledgeContext = relevantKnowledge.length > 0
      ? `\n\nBase de Conhecimento Relevante:\n${relevantKnowledge.map(k => 
          `### ${k.title}\n${k.content}`
        ).join('\n\n')}`
      : '';

    const contactTypeInstructions = contact_type === 'customer' 
      ? `
VOCÊ ESTÁ ATENDENDO UM CLIENTE.
- Seja empático, caloroso e genuinamente prestativo
- Trate como um amigo que você quer ajudar
- Se não souber algo, ofereça verificar com a equipe de forma natural
`
      : `
VOCÊ ESTÁ ATENDENDO UMA TRANSPORTADORA.
- Seja profissional mas cordial
- Foque em informações logísticas de forma conversacional
`;

    // Get conversation style config
    const useSignature = (config as any).use_signature ?? false;
    const closingStyle = (config as any).closing_style ?? 'varied';
    const conversationStyle = (config as any).conversation_style ?? 'chatty';
    const avoidRepetition = (config as any).avoid_repetition ?? true;
    const forbiddenPhrases = (config as any).forbidden_phrases ?? [
      'Qualquer dúvida, estou à disposição',
      'Fico no aguardo',
      'Abraço, Equipe Imply',
      'Equipe Imply',
      'Atenciosamente',
      'Estou à disposição',
      'Fico à disposição'
    ];

    // CRITICAL: Action instruction based on found order
    const actionInstruction = foundOrder 
      ? `🚨 IMPORTANTE - VOCÊ JÁ TEM OS DADOS DO PEDIDO!
Você JÁ SABE a resposta. NUNCA diga "vou verificar", "deixa eu ver", "um momentinho".
USE OS DADOS ABAIXO DIRETAMENTE na sua resposta de forma conversacional.
INFORME o status, data de entrega e outras informações IMEDIATAMENTE.`
      : `⚠️ NENHUM PEDIDO ENCONTRADO
- Se o cliente pergunta sobre pedido, peça o número de forma natural: "Qual o número do seu pedido?"
- Ou peça o nome/CPF para localizar
- NÃO invente informações de pedido`;

    // Confirmation instruction when order found
    const confirmationInstruction = foundOrder
      ? `📋 APÓS informar os dados, pergunte naturalmente SE ERA ISSO que o cliente queria:
- "Era sobre esse pedido?"
- "É esse mesmo que você tava procurando?"
- "Te ajudei? Precisa de mais alguma coisa?"`
      : '';

    // Forbidden phrases - VERY EMPHATIC
    const forbiddenPhrasesText = `
🚫 ABSOLUTAMENTE PROIBIDO - FRASES QUE JAMAIS DEVEM APARECER:
${forbiddenPhrases.map((p: string) => `❌ "${p}" - NUNCA USE ISSO!`).join('\n')}

⚠️ TAMBÉM PROIBIDO:
❌ "Vou verificar..." (se você JÁ TEM os dados - use-os!)
❌ "Deixa eu ver..." (se você JÁ TEM os dados)
❌ "Um momentinho..." (se você JÁ TEM os dados)
❌ "Aguarde que vou consultar..." (se você JÁ TEM os dados)
❌ Emojis no início de cada linha como lista (📦... 📍... 📅...)
❌ Assinaturas formais como "Equipe X", "Atenciosamente"
❌ Repetir o mesmo fechamento da conversa anterior`;

    const signatureInstruction = useSignature 
      ? `Se apropriado, termine com assinatura: _${agentConfig.signature}_`
      : 'NÃO inclua assinatura formal no final. NUNCA termine com "Equipe Imply" ou similar.';

    const closingInstruction = closingStyle === 'varied'
      ? `✅ VARIE o fechamento (escolha UM diferente a cada vez):
- "Me avisa se precisar de algo!"
- "Tô por aqui!"
- "Qualquer coisa, chama!"
- "Conta comigo!"
- "Me fala se era isso!"
- Ou simplesmente não feche - deixe a conversa fluir naturalmente`
      : closingStyle === 'none'
      ? 'NÃO inclua fechamento ou despedida'
      : `Use fechamento simples e varie sempre`;

    const styleInstruction = conversationStyle === 'chatty'
      ? `Escreva como conversa de WhatsApp real - use "Olha só", "Hmm", "Sabe o que é", "Ah!", "Opa"`
      : conversationStyle === 'concise'
      ? `Seja direto mas amigável, sem enrolação`
      : `Tom profissional mas cordial`;

    const systemPrompt = `Você é ${agentConfig.agent_name}, assistente da IMPLY Tecnologia.

🎭 VOCÊ É UMA PESSOA REAL:
- Converse como amigo que quer ajudar de verdade
- Use expressões naturais: "Oi!", "Olha só", "Hmm", "Que bom!", "Sabe..."
- Demonstre empatia genuína
- VARIE sempre suas saudações e fechamentos

${actionInstruction}

${orderContext ? `
📦 DADOS DO PEDIDO QUE VOCÊ JÁ TEM (use-os!):
${orderContext}
` : ''}

${knowledgeContext}

💬 ESTILO: ${styleInstruction}

${agentConfig.custom_instructions || ''}
${contactTypeInstructions}

${forbiddenPhrasesText}

📝 FECHAMENTO:
${closingInstruction}
${signatureInstruction}

${confirmationInstruction}

⚠️ REGRAS CRÍTICAS:
1. Se TEM dados do pedido acima: INFORME-OS DIRETAMENTE. Nunca diga "vou verificar".
2. Se NÃO TEM dados: Peça número do pedido naturalmente.
3. NUNCA use formato de lista com emojis (📦 Pedido... 📍 Status...)
4. NUNCA repita fechamentos - varie SEMPRE
5. Use 1-2 emojis MAX por mensagem
6. Mantenha 3-5 linhas conversacionais
7. PEÇA CONFIRMAÇÃO se informou dados do pedido`;

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
        max_tokens: 300,
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
    const endpoint = `/rest/sendMessage/${megaApiInstance}/text`;
    const sendUrl = `${baseUrl}${endpoint}`;

    // Body formato Mega API: { messageData: { to, text, linkPreview } }
    const body = {
      messageData: {
        to: formattedPhone,
        text: generatedMessage,
        linkPreview: false,
      }
    };

    console.log(`📤 Sending to: ${sendUrl}`);
    console.log('📤 Body:', JSON.stringify(body));

    // Multi-header fallback para compatibilidade
    const authFormats: Record<string, string>[] = [
      { 'apikey': megaApiToken },
      { 'Authorization': `Bearer ${megaApiToken}` },
      { 'Apikey': megaApiToken },
    ];

    let megaResponse: Response | null = null;
    let megaResponseBody: any = null;
    let lastError = '';

    for (const authHeader of authFormats) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...authHeader,
        };

        const response = await fetch(sendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        const responseText = await response.text();
        console.log(`📤 Response (${Object.keys(authHeader)[0]}): ${response.status} - ${responseText.substring(0, 200)}`);

        if (response.ok) {
          megaResponse = response;
          try {
            megaResponseBody = JSON.parse(responseText);
          } catch {
            megaResponseBody = { raw: responseText };
          }
          console.log('✅ Message sent successfully');
          break; // Sucesso, sair do loop
        } else if (response.status === 401 || response.status === 403) {
          lastError = `${response.status}: ${responseText.substring(0, 200)}`;
          continue; // Tentar próximo header
        } else {
          lastError = `${response.status}: ${responseText.substring(0, 200)}`;
          break; // Outro erro, não tentar mais
        }
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`❌ Fetch error:`, lastError);
        continue;
      }
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
