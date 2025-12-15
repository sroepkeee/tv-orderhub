import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RAGSearchRequest {
  query: string;
  category?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, category, limit = 5 }: RAGSearchRequest = await req.json();
    console.log('RAG Search - Query:', query, 'Category:', category);

    // Tokenizar query para busca por keywords
    const queryTokens = query.toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 2)
      .map(token => token.replace(/[^\w]/g, ''));

    // Buscar na base de conhecimento
    let queryBuilder = supabase
      .from('ai_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data: allKnowledge, error } = await queryBuilder;

    if (error) {
      throw error;
    }

    // Calcular relevância simples baseado em matches de keywords
    const scoredResults = (allKnowledge || []).map(item => {
      let score = item.priority || 0;
      
      // Match em keywords
      if (item.keywords) {
        for (const keyword of item.keywords) {
          if (queryTokens.some(token => keyword.toLowerCase().includes(token))) {
            score += 10;
          }
        }
      }
      
      // Match no título
      const titleLower = item.title.toLowerCase();
      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          score += 5;
        }
      }
      
      // Match no conteúdo
      const contentLower = item.content.toLowerCase();
      for (const token of queryTokens) {
        if (contentLower.includes(token)) {
          score += 2;
        }
      }
      
      return { ...item, relevance_score: score };
    });

    // Ordenar por relevância e limitar
    const results = scoredResults
      .filter(item => item.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      query,
      tokens: queryTokens,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('RAG Search Error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
