-- Tabela para cache de análise de sentimento das conversas
CREATE TABLE IF NOT EXISTS public.conversation_sentiment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  contact_name TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'critical')),
  score NUMERIC(3,1),
  summary TEXT,
  topics TEXT[],
  pending_actions TEXT[],
  message_count INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(carrier_id)
);

-- Índice para busca rápida por sentimento
CREATE INDEX idx_sentiment_cache_sentiment ON public.conversation_sentiment_cache(sentiment);
CREATE INDEX idx_sentiment_cache_score ON public.conversation_sentiment_cache(score);

-- Enable RLS
ALTER TABLE public.conversation_sentiment_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view sentiment cache"
ON public.conversation_sentiment_cache FOR SELECT
USING (true);

CREATE POLICY "System can manage sentiment cache"
ON public.conversation_sentiment_cache FOR ALL
USING (true);

-- Enable realtime for carrier_conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.carrier_conversations;