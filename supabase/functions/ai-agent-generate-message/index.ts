import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateMessageRequest {
  order_id: string;
  context?: string;
  channel: 'whatsapp' | 'email';
  message_type: 'status_update' | 'custom' | 'response';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: GenerateMessageRequest = await req.json();
    console.log('AI Generate Message - Payload:', payload);

    // Buscar configuração do agente
    const { data: agentConfig } = await supabase
      .from('ai_agent_config')
      .select('*')
      .limit(1)
      .single();

    // Buscar pedido
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('id', payload.order_id)
      .single();

    if (!order) {
      throw new Error('Order not found');
    }

    // Buscar conhecimento relevante (RAG)
    const ragResponse = await fetch(`${supabaseUrl}/functions/v1/ai-agent-rag-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        query: payload.context || order.status,
        limit: 3,
      }),
    });

    const ragData = await ragResponse.json();
    const knowledgeContext = ragData.results
      ?.map((r: any) => `[${r.title}]: ${r.content}`)
      .join('\n\n') || '';

    // Construir prompt para o LLM
    const systemPrompt = `Você é ${agentConfig?.agent_name || 'Assistente Imply'}, um assistente virtual da empresa Imply Tecnologia.

PERSONALIDADE: ${agentConfig?.personality || 'Profissional, cordial e prestativo'}
TOM DE VOZ: ${agentConfig?.tone_of_voice || 'formal'}
IDIOMA: ${agentConfig?.language || 'pt-BR'}

${agentConfig?.custom_instructions || ''}

CONHECIMENTO DA EMPRESA:
${knowledgeContext}

REGRAS:
- Seja conciso e objetivo
- Use emojis moderadamente para ${payload.channel === 'whatsapp' ? 'WhatsApp' : 'evite em emails formais'}
- Sempre inclua o número do pedido quando relevante
- Assine como: ${agentConfig?.signature || 'Equipe Imply'}
- ${payload.channel === 'whatsapp' ? 'Use formatação WhatsApp: *negrito* e _itálico_' : 'Use formatação HTML para emails'}`;

    const userPrompt = `Gere uma mensagem de ${payload.message_type === 'status_update' ? 'atualização de status' : 'resposta ao cliente'} para o seguinte pedido:

PEDIDO: #${order.order_number}
CLIENTE: ${order.customer_name}
STATUS ATUAL: ${order.status}
ITENS: ${order.order_items?.length || 0} itens
DATA DE ENTREGA: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
TRANSPORTADORA: ${order.carrier_name || 'Não definida'}
RASTREIO: ${order.tracking_code || 'Não disponível'}

${payload.context ? `CONTEXTO ADICIONAL: ${payload.context}` : ''}

Canal: ${payload.channel.toUpperCase()}`;

    // Chamar Lovable AI Gateway
    if (!lovableApiKey) {
      // Fallback sem IA - retornar template básico
      const basicMessage = payload.channel === 'whatsapp'
        ? `Olá ${order.customer_name}! 👋\n\nSeu pedido *#${order.order_number}* está com status: ${order.status}.\n\n${agentConfig?.signature || 'Equipe Imply'}`
        : `<p>Olá ${order.customer_name},</p><p>Seu pedido #${order.order_number} está com status: ${order.status}.</p><p>Atenciosamente,<br>${agentConfig?.signature || 'Equipe Imply'}</p>`;

      return new Response(JSON.stringify({ 
        success: true, 
        message: basicMessage,
        ai_generated: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ 
      success: true, 
      message: generatedMessage,
      ai_generated: true,
      knowledge_used: ragData.results?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('AI Generate Message Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
