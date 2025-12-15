-- 1. Adicionar coluna agent_type à tabela ai_agent_config
ALTER TABLE public.ai_agent_config ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT 'carrier';

-- 2. Adicionar coluna agent_type à tabela ai_knowledge_base
ALTER TABLE public.ai_knowledge_base ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT 'general';

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_ai_agent_config_agent_type ON public.ai_agent_config(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_agent_type ON public.ai_knowledge_base(agent_type);