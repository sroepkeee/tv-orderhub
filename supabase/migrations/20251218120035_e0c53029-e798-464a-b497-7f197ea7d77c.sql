-- Add identity and configuration fields to ai_agent_instances
ALTER TABLE ai_agent_instances 
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'Profissional, amigável e prestativo',
ADD COLUMN IF NOT EXISTS tone_of_voice TEXT DEFAULT 'informal',
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR',
ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS use_signature BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS auto_reply_delay_ms INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS conversation_style TEXT DEFAULT 'chatty',
ADD COLUMN IF NOT EXISTS closing_style TEXT DEFAULT 'varied',
ADD COLUMN IF NOT EXISTS avoid_repetition BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS forbidden_phrases TEXT[] DEFAULT ARRAY['Qualquer dúvida, estou à disposição', 'Fico no aguardo'];

-- Update existing instances with default system prompts
UPDATE ai_agent_instances 
SET system_prompt = CASE 
  WHEN agent_type = 'carrier' THEN 'Você é um agente de logística especializado em rastreamento, cotações de frete e comunicação com transportadoras. Seja direto, profissional e sempre forneça informações precisas sobre prazos e status de entrega.'
  WHEN agent_type = 'customer' THEN 'Você é um assistente de atendimento ao cliente da Imply Tecnologia. Seja cordial, empático e ajude os clientes com informações sobre seus pedidos, status de entrega e suporte geral.'
  WHEN agent_type = 'after_sales' THEN 'Você é especialista em pós-venda da Imply Tecnologia. Auxilie com garantias, trocas, devoluções e suporte técnico. Seja empático e focado em resolver problemas do cliente.'
  ELSE 'Você é um assistente virtual da Imply Tecnologia. Ajude os usuários de forma profissional e amigável.'
END
WHERE system_prompt IS NULL;