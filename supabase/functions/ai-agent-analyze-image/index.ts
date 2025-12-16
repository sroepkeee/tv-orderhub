import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaId, base64Image, mimeType, context } = await req.json();

    if (!base64Image) {
      throw new Error('base64Image é obrigatório');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('🖼️ Analyzing image with AI...');
    console.log('📊 Context:', context || 'none');

    const systemPrompt = `Você é um assistente especializado em análise de imagens para um sistema de logística da IMPLY Tecnologia.

Analise a imagem enviada e retorne um JSON com os seguintes campos:
- tipo: tipo do documento/foto (comprovante, embalagem, produto, dano, nota_fiscal, etiqueta, foto_entrega, outro)
- detalhes: detalhes específicos identificados na imagem
- relevante_para_pedido: boolean - se a imagem contém informações relevantes para pedidos (NF, código de rastreio, etc.)
- detectou_problema: boolean - se há evidência de dano, problema ou irregularidade
- resumo: resumo em português do que está na imagem (máximo 100 palavras)
- dados_extraidos: objeto com dados específicos extraídos (número NF, código rastreio, etc.) se aplicável

Seja objetivo e focado em informações relevantes para logística e expedição.`;

    const userContent = [
      {
        type: 'text',
        text: context 
          ? `Analise esta imagem. Contexto adicional: ${context}`
          : 'Analise esta imagem enviada pelo cliente via WhatsApp.'
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`
        }
      }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponseText = data.choices?.[0]?.message?.content || '';

    console.log('🤖 AI Response:', aiResponseText);

    // Parse JSON from response
    let analysis = null;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('⚠️ Could not parse AI response as JSON, using raw text');
      analysis = {
        tipo: 'outro',
        resumo: aiResponseText,
        detectou_problema: false,
        relevante_para_pedido: false,
      };
    }

    // If mediaId provided, update the database
    if (mediaId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('whatsapp_media')
        .update({ ai_analysis: analysis })
        .eq('id', mediaId);

      if (updateError) {
        console.error('❌ Error updating media with analysis:', updateError);
      } else {
        console.log('✅ Media analysis saved to database');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        raw_response: aiResponseText 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in ai-agent-analyze-image:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
