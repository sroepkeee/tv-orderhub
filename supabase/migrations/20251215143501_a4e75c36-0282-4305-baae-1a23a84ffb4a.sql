-- Add auto-reply configuration columns to ai_agent_config
ALTER TABLE public.ai_agent_config 
ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS llm_model text NOT NULL DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS max_response_time_seconds integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS human_handoff_keywords text[] DEFAULT ARRAY['humano', 'atendente', 'pessoa', 'falar com alguém', 'suporte']::text[],
ADD COLUMN IF NOT EXISTS auto_reply_delay_ms integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS auto_reply_contact_types text[] DEFAULT ARRAY['carrier', 'customer']::text[];