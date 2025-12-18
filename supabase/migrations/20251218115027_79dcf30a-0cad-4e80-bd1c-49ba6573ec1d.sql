
-- Tabela para instâncias de agentes (cada agente tem seu próprio número WhatsApp)
CREATE TABLE public.ai_agent_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'general',
  whatsapp_number TEXT,
  whatsapp_instance_id TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  personality_traits JSONB DEFAULT '[]'::jsonb,
  specializations TEXT[] DEFAULT ARRAY[]::TEXT[],
  response_style JSONB DEFAULT '{}'::jsonb,
  emoji_library TEXT[] DEFAULT ARRAY['😊', '👍', '✅', '📦', '🚚']::TEXT[],
  max_message_length INTEGER DEFAULT 150,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para feedback de aprendizado
CREATE TABLE public.ai_learning_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_instance_id UUID REFERENCES public.ai_agent_instances(id),
  conversation_id UUID REFERENCES public.carrier_conversations(id),
  message_content TEXT NOT NULL,
  response_content TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  resolution_status TEXT DEFAULT 'pending', -- pending, resolved, escalated, failed
  response_time_ms INTEGER,
  tokens_used INTEGER,
  knowledge_gaps_detected TEXT[] DEFAULT ARRAY[]::TEXT[],
  customer_sentiment TEXT, -- positive, neutral, negative
  required_human_intervention BOOLEAN DEFAULT false,
  feedback_source TEXT DEFAULT 'auto', -- auto, human, system
  feedback_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para sugestões de conhecimento automáticas
CREATE TABLE public.ai_knowledge_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_instance_id UUID REFERENCES public.ai_agent_instances(id),
  conversation_id UUID REFERENCES public.carrier_conversations(id),
  suggestion_type TEXT NOT NULL DEFAULT 'new_knowledge', -- new_knowledge, update_existing, merge
  suggested_title TEXT NOT NULL,
  suggested_content TEXT NOT NULL,
  suggested_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  suggested_category TEXT DEFAULT 'geral',
  source_question TEXT,
  detection_reason TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, merged
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_knowledge_id UUID REFERENCES public.ai_knowledge_base(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para métricas de evolução dos agentes
CREATE TABLE public.ai_agent_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_instance_id UUID REFERENCES public.ai_agent_instances(id),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_confidence_score NUMERIC(3,2) DEFAULT 0,
  resolution_rate NUMERIC(5,2) DEFAULT 0,
  escalation_rate NUMERIC(5,2) DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  knowledge_gaps_count INTEGER DEFAULT 0,
  suggestions_generated INTEGER DEFAULT 0,
  suggestions_approved INTEGER DEFAULT 0,
  positive_sentiment_rate NUMERIC(5,2) DEFAULT 0,
  negative_sentiment_rate NUMERIC(5,2) DEFAULT 0,
  tokens_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_instance_id, metric_date)
);

-- Enable RLS
ALTER TABLE public.ai_agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_metrics ENABLE ROW LEVEL SECURITY;

-- Policies para ai_agent_instances
CREATE POLICY "AI Agent admins can manage instances"
ON public.ai_agent_instances FOR ALL
USING (is_ai_agent_admin(auth.uid()));

-- Policies para ai_learning_feedback
CREATE POLICY "AI Agent admins can manage feedback"
ON public.ai_learning_feedback FOR ALL
USING (is_ai_agent_admin(auth.uid()));

-- Policies para ai_knowledge_suggestions
CREATE POLICY "AI Agent admins can manage suggestions"
ON public.ai_knowledge_suggestions FOR ALL
USING (is_ai_agent_admin(auth.uid()));

-- Policies para ai_agent_metrics
CREATE POLICY "AI Agent admins can manage metrics"
ON public.ai_agent_metrics FOR ALL
USING (is_ai_agent_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_ai_agent_instances_updated_at
  BEFORE UPDATE ON public.ai_agent_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_knowledge_suggestions_updated_at
  BEFORE UPDATE ON public.ai_knowledge_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir instância padrão do agente de logística existente
INSERT INTO public.ai_agent_instances (instance_name, agent_type, description, specializations, emoji_library, response_style)
VALUES (
  'Agente Logística',
  'carrier',
  'Especialista em logística, rastreamento e cotações de frete',
  ARRAY['rastreamento', 'frete', 'entregas', 'transportadoras'],
  ARRAY['📦', '🚚', '✅', '📍', '⏰', '👍'],
  '{"tone": "professional", "formality": "semi-formal", "empathy_level": "medium"}'::jsonb
);

-- Inserir instância do agente de pós-venda
INSERT INTO public.ai_agent_instances (instance_name, agent_type, description, specializations, emoji_library, response_style)
VALUES (
  'Agente Pós-Venda',
  'after_sales',
  'Especialista em atendimento ao cliente, garantias e suporte técnico',
  ARRAY['garantia', 'suporte', 'troca', 'devolução', 'defeito'],
  ARRAY['🛠️', '✨', '💡', '🤝', '❤️', '👋'],
  '{"tone": "empathetic", "formality": "informal", "empathy_level": "high"}'::jsonb
);
