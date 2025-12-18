-- Tabela para buffer de mensagens com debounce
CREATE TABLE IF NOT EXISTS public.pending_ai_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  receiver_phone TEXT,
  contact_type TEXT DEFAULT 'carrier',
  messages_buffer JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_reply_at TIMESTAMP WITH TIME ZONE NOT NULL,
  conversation_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint para evitar múltiplos buffers para mesmo contato
  CONSTRAINT unique_pending_reply_per_contact UNIQUE (carrier_id, sender_phone)
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_pending_ai_replies_scheduled 
  ON public.pending_ai_replies(scheduled_reply_at) 
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_ai_replies_carrier 
  ON public.pending_ai_replies(carrier_id);

-- Enable RLS
ALTER TABLE public.pending_ai_replies ENABLE ROW LEVEL SECURITY;

-- Policy para sistema gerenciar
CREATE POLICY "System can manage pending replies"
  ON public.pending_ai_replies FOR ALL
  USING (true);

-- Adicionar campo search_orders em ai_agent_instances para separar domínios
ALTER TABLE public.ai_agent_instances 
  ADD COLUMN IF NOT EXISTS search_orders BOOLEAN DEFAULT true;

-- Adicionar campo domain_type para especialização
ALTER TABLE public.ai_agent_instances 
  ADD COLUMN IF NOT EXISTS domain_type TEXT DEFAULT 'general';

-- Comentários
COMMENT ON TABLE public.pending_ai_replies IS 'Buffer para debounce de mensagens WhatsApp - aguarda 5 segundos antes de responder';
COMMENT ON COLUMN public.pending_ai_replies.messages_buffer IS 'Array de mensagens recebidas durante o período de debounce';
COMMENT ON COLUMN public.pending_ai_replies.scheduled_reply_at IS 'Quando a resposta deve ser processada (first_message_at + 5 segundos)';
COMMENT ON COLUMN public.ai_agent_instances.search_orders IS 'Se o agente deve buscar pedidos automaticamente (false para pós-venda)';
COMMENT ON COLUMN public.ai_agent_instances.domain_type IS 'Tipo de domínio: general, logistics, after_sales, support';