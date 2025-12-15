import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversationMessage {
  message_content: string;
  message_direction: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { carrierId, contactName } = await req.json();

    if (!carrierId) {
      return new Response(
        JSON.stringify({ error: "carrierId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all messages from this conversation
    const { data: messages, error: messagesError } = await supabase
      .from("carrier_conversations")
      .select("message_content, message_direction, created_at")
      .eq("carrier_id", carrierId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          sentiment: "neutral",
          score: 5,
          summary: "Nenhuma mensagem encontrada nesta conversa.",
          topics: [],
          pending_actions: [],
          message_count: 0,
          last_interaction: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format messages for the LLM
    const formattedMessages = messages.map((msg: ConversationMessage) => {
      const direction = msg.message_direction === "outbound" ? "EMPRESA" : "CONTATO";
      return `[${direction}]: ${msg.message_content}`;
    }).join("\n");

    const lastMessage = messages[messages.length - 1];
    const inboundCount = messages.filter((m: ConversationMessage) => m.message_direction === "inbound").length;
    const outboundCount = messages.filter((m: ConversationMessage) => m.message_direction === "outbound").length;

    // Call Lovable AI Gateway for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um analista de conversas especializado em logística e atendimento.
Analise a conversa fornecida e retorne um JSON com a seguinte estrutura:

{
  "sentiment": "positive" | "neutral" | "negative" | "critical",
  "score": número de 1 a 10,
  "summary": "resumo executivo de 2-3 frases",
  "topics": ["lista", "de", "tópicos", "principais"],
  "pending_actions": ["ações pendentes se houver"]
}

REGRAS:
- sentiment: baseado no tom geral (positive=satisfeito, neutral=normal, negative=insatisfeito, critical=urgente/problema grave)
- score: 1-10 onde 10 é excelente relacionamento/conversa produtiva
- summary: seja conciso e objetivo
- topics: máximo 5 tópicos principais
- pending_actions: liste apenas se houver algo claro a resolver

Retorne APENAS o JSON, sem texto adicional.`;

    const userPrompt = `Contato: ${contactName || "Desconhecido"}
Mensagens trocadas: ${messages.length} (${outboundCount} enviadas, ${inboundCount} recebidas)

CONVERSA:
${formattedMessages}`;

    console.log("Calling Lovable AI Gateway for conversation summary...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      // Return a default analysis if AI fails
      return new Response(
        JSON.stringify({
          sentiment: "neutral",
          score: 5,
          summary: `Conversa com ${messages.length} mensagens. Análise automática indisponível no momento.`,
          topics: ["comunicação geral"],
          pending_actions: [],
          message_count: messages.length,
          inbound_count: inboundCount,
          outbound_count: outboundCount,
          last_interaction: lastMessage.created_at
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    console.log("AI Response:", aiContent);

    // Parse AI response
    let analysis;
    try {
      // Clean up the response in case it has markdown code blocks
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      analysis = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, aiContent);
      analysis = {
        sentiment: "neutral",
        score: 5,
        summary: `Conversa com ${messages.length} mensagens entre empresa e contato.`,
        topics: ["comunicação"],
        pending_actions: []
      };
    }

    // Enrich with metadata
    const result = {
      ...analysis,
      message_count: messages.length,
      inbound_count: inboundCount,
      outbound_count: outboundCount,
      last_interaction: lastMessage.created_at
    };

    console.log("Conversation summary generated:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in ai-agent-conversation-summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao gerar resumo";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
