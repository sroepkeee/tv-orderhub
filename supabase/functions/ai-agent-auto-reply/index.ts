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
    const triggerKeywords = agentConfig.human_handoff_keywords?.filter(
      keyword => lowerMessage.includes(keyword.toLowerCase())
    ) || [];
    const needsHumanHandoff = triggerKeywords.length > 0;

    if (needsHumanHandoff) {
      console.log('🧑 Human handoff triggered by keywords:', triggerKeywords);
      
      // Mark handoff in conversation_sentiment_cache
      const handoffReason = triggerKeywords.join(', ');
      
      if (carrier_id) {
        // Upsert to mark requires_human_handoff
        const { error: cacheError } = await supabase
          .from('conversation_sentiment_cache')
          .upsert({
            carrier_id,
            requires_human_handoff: true,
            handoff_reason: handoffReason,
            handoff_detected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'carrier_id'
          });

        if (cacheError) {
          console.error('❌ Error marking handoff in cache:', cacheError);
        } else {
          console.log('✅ Marked requires_human_handoff=true in sentiment cache');
        }
      }
      
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
          trigger_keywords: triggerKeywords
        }
      });

      // Send confirmation message to customer that we're transferring
      const handoffMessage = "Entendi que você prefere falar com uma pessoa. Estou transferindo para nosso time agora mesmo! 🧑‍💼 Alguém vai te atender em breve.";
      
      // Get connected WhatsApp instance
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select('instance_key')
        .eq('status', 'connected')
        .limit(1)
        .single();

      if (instanceData?.instance_key) {
        const megaApiUrl = Deno.env.get('MEGA_API_URL') || '';
        const megaApiToken = Deno.env.get('MEGA_API_TOKEN') || '';
        
        // Normalize URL
        let baseUrl = megaApiUrl.trim();
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = 'https://' + baseUrl;
        }
        baseUrl = baseUrl.replace(/\/$/, '');
        
        // Format phone number
        const phoneNumber = sender_phone.replace(/\D/g, '');
        const formattedPhone = phoneNumber.startsWith('55') ? phoneNumber : `55${phoneNumber}`;
        
        try {
          const sendResponse = await fetch(`${baseUrl}/message/sendText/${instanceData.instance_key}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': megaApiToken
            },
            body: JSON.stringify({
              number: formattedPhone,
              textMessage: { text: handoffMessage }
            })
          });

          if (sendResponse.ok) {
            console.log('✅ Handoff confirmation message sent');
            
            // Save outbound message to database
            await supabase.from('carrier_conversations').insert({
              carrier_id,
              message_content: handoffMessage,
              message_direction: 'outbound',
              conversation_type: 'general',
              contact_type,
              sent_at: new Date().toISOString(),
              message_metadata: {
                is_ai_generated: true,
                sent_via: 'ai-agent-handoff',
                handoff_keywords: triggerKeywords
              }
            });
          }
        } catch (sendError) {
          console.error('❌ Error sending handoff message:', sendError);
        }
      }

      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'human_handoff_required',
        handoff_keywords: triggerKeywords,
        handoff_message_sent: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. FETCH CONVERSATION HISTORY (last 20 messages for context)
    console.log('📜 Fetching conversation history...');
    let conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];

    if (carrier_id) {
      // Fetch by carrier_id
      const { data: historyData } = await supabase
        .from('carrier_conversations')
        .select('message_content, message_direction, sent_at')
        .eq('carrier_id', carrier_id)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (historyData && historyData.length > 0) {
        // Reverse to chronological order (oldest first)
        const reversedHistory = [...historyData].reverse();
        
        conversationHistory = reversedHistory
          .filter(msg => msg.message_content && msg.message_content.trim())
          .map(msg => ({
            role: msg.message_direction === 'inbound' ? 'user' as const : 'assistant' as const,
            content: msg.message_content
          }));
        
        console.log(`📜 Loaded ${conversationHistory.length} previous messages for context`);
      }
    } else if (sender_phone) {
      // Fallback: search by phone number across carriers
      const phoneDigits = sender_phone.replace(/\D/g, '').slice(-8);
      
      const { data: carrierMatch } = await supabase
        .from('carriers')
        .select('id')
        .ilike('whatsapp', `%${phoneDigits}%`)
        .limit(1)
        .single();

      if (carrierMatch) {
        const { data: historyData } = await supabase
          .from('carrier_conversations')
          .select('message_content, message_direction, sent_at')
          .eq('carrier_id', carrierMatch.id)
          .order('sent_at', { ascending: false })
          .limit(20);

        if (historyData && historyData.length > 0) {
          const reversedHistory = [...historyData].reverse();
          
          conversationHistory = reversedHistory
            .filter(msg => msg.message_content && msg.message_content.trim())
            .map(msg => ({
              role: msg.message_direction === 'inbound' ? 'user' as const : 'assistant' as const,
              content: msg.message_content
            }));
          
          console.log(`📜 Loaded ${conversationHistory.length} previous messages (by phone) for context`);
        }
      }
    }

    // 5. EXTRACT ORDER NUMBER FROM MESSAGE
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

    // Helper function to translate freight type
    const translateFreightType = (type: string | null): string => {
      if (!type) return 'Não informado';
      const labels: Record<string, string> = {
        'CIF': 'CIF (Frete por conta do remetente)',
        'FOB': 'FOB (Frete por conta do destinatário)',
        'cif': 'CIF (Frete por conta do remetente)',
        'fob': 'FOB (Frete por conta do destinatário)',
      };
      return labels[type] || type;
    };

    // Helper function to translate shipping modality
    const translateShippingModality = (modality: string | null): string => {
      if (!modality) return 'Não definido';
      const labels: Record<string, string> = {
        'rodoviario': 'Rodoviário (Caminhão)',
        'aereo': 'Aéreo',
        'maritimo': 'Marítimo',
        'correios': 'Correios',
        'moto': 'Motoboy/Courier',
        'retira': 'Cliente Retira',
        'proprio': 'Veículo Próprio',
        'sedex': 'Sedex',
        'pac': 'PAC',
      };
      return labels[modality?.toLowerCase()] || modality;
    };

    // Try to find order by extracted number
    if (extractedOrderNumber) {
      console.log(`🔍 Searching for order: ${extractedOrderNumber}`);
      const { data: order } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          totvs_order_number,
          status,
          delivery_date,
          carrier_name,
          tracking_code,
          customer_name,
          municipality,
          issue_date,
          freight_type,
          freight_modality,
          package_volumes,
          package_weight_kg,
          package_height_m,
          package_width_m,
          package_length_m,
          shipping_date
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
          id,
          order_number,
          totvs_order_number,
          status,
          delivery_date,
          carrier_name,
          tracking_code,
          customer_name,
          municipality,
          issue_date,
          freight_type,
          freight_modality,
          package_volumes,
          package_weight_kg,
          package_height_m,
          package_width_m,
          package_length_m,
          shipping_date
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
            id,
            order_number,
            totvs_order_number,
            status,
            delivery_date,
            carrier_name,
            tracking_code,
            customer_name,
            municipality,
            issue_date,
            freight_type,
            freight_modality,
            package_volumes,
            package_weight_kg,
            package_height_m,
            package_width_m,
            package_length_m,
            shipping_date
          `)
          .eq('id', customerContact.last_order_id)
          .single();

        if (order) {
          foundOrder = order;
        }
      }
    }

    // FETCH ITEMS AND VOLUMES for found order
    let itemsCount = 0;
    let itemsTotalQuantity = 0;
    let volumesDetails: any[] = [];

    if (foundOrder?.id) {
      console.log(`📦 Fetching items and volumes for order ${foundOrder.order_number}`);
      
      // Fetch items count
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, item_code, item_description, requested_quantity')
        .eq('order_id', foundOrder.id);
      
      if (itemsData) {
        itemsCount = itemsData.length;
        itemsTotalQuantity = itemsData.reduce((sum, item) => 
          sum + Number(item.requested_quantity || 0), 0);
        console.log(`📋 Found ${itemsCount} items, total qty: ${itemsTotalQuantity}`);
      }

      // Fetch volumes
      const { data: volumesData } = await supabase
        .from('order_volumes')
        .select('volume_number, quantity, weight_kg, length_cm, width_cm, height_cm, packaging_type')
        .eq('order_id', foundOrder.id)
        .order('volume_number');
      
      if (volumesData) {
        volumesDetails = volumesData;
        console.log(`📊 Found ${volumesData.length} volumes`);
      }
    }

    // Build order context with ENRICHED information (no sensitive data)
    if (foundOrder) {
      // Calculate cubagem if dimensions available
      const cubagem = foundOrder.package_height_m && foundOrder.package_width_m && foundOrder.package_length_m
        ? (foundOrder.package_height_m * foundOrder.package_width_m * foundOrder.package_length_m).toFixed(3)
        : null;

      // Calculate total weight from volumes if main weight not available
      const totalWeight = foundOrder.package_weight_kg 
        || volumesDetails.reduce((sum, v) => sum + Number(v.weight_kg || 0), 0);

      // Format volumes details
      const volumesInfo = volumesDetails.length > 0
        ? volumesDetails.map((v: any) => 
            `  - Volume ${v.volume_number}: ${v.weight_kg}kg, ${v.length_cm}x${v.width_cm}x${v.height_cm}cm (${v.packaging_type || 'caixa'})`
          ).join('\n')
        : null;

      orderContext = `
📦 DADOS DO PEDIDO ENCONTRADO:
Pedido: *${foundOrder.order_number}*
Status: ${translateStatus(foundOrder.status)}
Data de Emissão: ${formatDate(foundOrder.issue_date)}
Data de Entrega Prevista: ${formatDate(foundOrder.delivery_date)}
${foundOrder.shipping_date ? `Data de Expedição: ${formatDate(foundOrder.shipping_date)}` : ''}

🚚 LOGÍSTICA:
Transportadora: ${foundOrder.carrier_name || 'Pendente definição'}
Tipo de Frete: ${translateFreightType(foundOrder.freight_type)}
Modo de Envio: ${translateShippingModality(foundOrder.freight_modality)}
Rastreio: ${foundOrder.tracking_code || 'Aguardando código'}
Destino: ${foundOrder.municipality || '-'}

📊 VOLUMES E DIMENSÕES:
Total de Volumes: ${foundOrder.package_volumes || volumesDetails.length || 'Não informado'}
Peso Total: ${totalWeight ? totalWeight + ' kg' : 'Não calculado'}
${cubagem ? `Cubagem: ${cubagem} m³` : ''}
${volumesInfo ? `Detalhes:\n${volumesInfo}` : ''}

📋 ITENS DO PEDIDO:
Total de Itens: ${itemsCount} item(s) diferente(s)
Quantidade Total: ${itemsTotalQuantity} unidade(s)

⚠️ NÃO revele: valores monetários, CPF/CNPJ, endereço completo, dados bancários.
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

📦 INFORMAÇÕES QUE VOCÊ PODE FORNECER QUANDO PERGUNTADO:
- Número do pedido
- Status atual (traduzido para linguagem amigável)
- Data de emissão (quando foi feito o pedido)
- Data de entrega prevista
- Nome da transportadora
- Tipo de frete (CIF = remetente paga, FOB = destinatário paga)
- Modo de envio (rodoviário, aéreo, correios, etc.)
- Código de rastreio (se disponível)
- Quantidade de volumes e peso total
- Quantidade de itens no pedido

💡 EXEMPLOS DE COMO RESPONDER:
- "Quando foi emitido?" → "Seu pedido foi feito no dia [data de emissão]"
- "Quem vai entregar?" → "Vai pela [transportadora]! O frete é [CIF/FOB]"
- "O frete é CIF ou FOB?" → "É [CIF/FOB], então [quem paga]"
- "Quantos volumes?" → "São [X] volumes, totalizando [Y] kg"
- "Quantos itens tem?" → "Tem [X] itens diferentes, [Y] unidades no total"

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
    console.log(`📜 Including ${conversationHistory.length} previous messages in context`);

    // Build messages array with conversation history
    const messagesForLLM: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history context (if exists)
    if (conversationHistory.length > 0) {
      // Add a context marker for the AI
      messagesForLLM.push({
        role: 'system',
        content: `📜 HISTÓRICO DA CONVERSA (${conversationHistory.length} mensagens anteriores):
Use este contexto para:
- Entender o que já foi perguntado/respondido
- Não repetir informações já dadas
- Manter consistência e continuidade
- Saber quais pedidos/temas já foram mencionados`
      });

      // Add previous messages
      for (const historyMsg of conversationHistory) {
        messagesForLLM.push(historyMsg);
      }
    }

    // Add current message
    messagesForLLM.push({ 
      role: 'user', 
      content: `Mensagem recebida de ${carrier_name || 'contato'} (${sender_phone}):\n\n${message_content}` 
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agentConfig.llm_model || 'gpt-4o-mini',
        messages: messagesForLLM,
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
    console.log('💾 [Save] Salvando resposta do agente em carrier_conversations...');
    console.log('💾 [Save] Dados:', { carrier_id, order_id, contact_type, messageSent });
    
    if (carrier_id) {
      const { data: insertData, error: insertError } = await supabase
        .from('carrier_conversations')
        .insert({
          carrier_id,
          order_id: order_id || null, // Garantir null explícito se undefined
          conversation_type: 'general', // Usar 'general' para consistência com outras mensagens
          message_direction: 'outbound',
          message_content: generatedMessage,
          contact_type: contact_type || 'carrier', // Usar contact_type do request
          message_metadata: {
            sent_via: 'ai_agent_auto_reply',
            model: agentConfig.llm_model,
            processing_time_ms: Date.now() - startTime,
            mega_response: sendResult,
            is_ai_generated: true,
          },
          sent_at: new Date().toISOString(),
          delivered_at: messageSent ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ [Save] Erro ao salvar resposta em carrier_conversations:', insertError);
        console.error('❌ [Save] Detalhes:', JSON.stringify(insertError, null, 2));
      } else {
        console.log('✅ [Save] Resposta salva com sucesso! ID:', insertData?.id);
      }
    } else {
      console.warn('⚠️ [Save] Sem carrier_id, não salvando em carrier_conversations');
    }

    // 10. Log to ai_notification_log (sempre salvar para rastreabilidade)
    console.log('📝 [Log] Salvando em ai_notification_log...');
    const { data: logData, error: logError } = await supabase
      .from('ai_notification_log')
      .insert({
        channel: 'whatsapp',
        recipient: sender_phone,
        message_content: generatedMessage,
        status: messageSent ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        order_id: order_id || null,
        metadata: {
          conversation_id,
          carrier_id,
          carrier_name,
          contact_type,
          order_id,
          generated_by: 'ai_agent_auto_reply',
          model: agentConfig.llm_model,
          processing_time_ms: Date.now() - startTime,
          knowledge_used: relevantKnowledge.map(k => k.title),
          conversation_history_count: conversationHistory.length,
          openai_usage: openaiData.usage,
          message_sent: messageSent,
        }
      })
      .select('id')
      .single();

    if (logError) {
      console.error('❌ [Log] Erro ao salvar em ai_notification_log:', logError);
    } else {
      console.log('✅ [Log] Log salvo com sucesso! ID:', logData?.id);
    }

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
