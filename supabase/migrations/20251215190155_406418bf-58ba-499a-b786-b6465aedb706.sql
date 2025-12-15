-- Add conversation style configuration columns to ai_agent_config
ALTER TABLE public.ai_agent_config 
ADD COLUMN IF NOT EXISTS use_signature boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS closing_style text DEFAULT 'varied',
ADD COLUMN IF NOT EXISTS conversation_style text DEFAULT 'chatty',
ADD COLUMN IF NOT EXISTS avoid_repetition boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS forbidden_phrases text[] DEFAULT ARRAY['Qualquer dúvida, estou à disposição', 'Fico no aguardo', 'Abraço, Equipe Imply', 'Equipe Imply', 'Atenciosamente'];

-- Add comment explaining columns
COMMENT ON COLUMN public.ai_agent_config.use_signature IS 'Whether to include signature at end of messages';
COMMENT ON COLUMN public.ai_agent_config.closing_style IS 'Message closing style: varied, fixed, or none';
COMMENT ON COLUMN public.ai_agent_config.conversation_style IS 'Conversation style: chatty, concise, or formal';
COMMENT ON COLUMN public.ai_agent_config.avoid_repetition IS 'Actively avoid repetitive phrases';
COMMENT ON COLUMN public.ai_agent_config.forbidden_phrases IS 'Phrases the agent should never use';