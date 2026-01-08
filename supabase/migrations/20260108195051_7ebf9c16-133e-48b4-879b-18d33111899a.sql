-- Criar instância de agente para clientes (logistics-reply)
INSERT INTO public.ai_agent_instances (
  instance_name,
  agent_type,
  is_active,
  auto_reply_enabled,
  search_orders,
  domain_type,
  description,
  personality,
  tone_of_voice,
  language,
  llm_model,
  conversation_style,
  closing_style,
  avoid_repetition,
  auto_reply_delay_ms,
  system_prompt,
  custom_instructions,
  forbidden_phrases
)
SELECT 
  'Agente Atendimento Cliente',
  'customer',
  true,
  true,
  true,
  'logistics',
  'Agente especializado em atendimento a clientes - Responde sobre pedidos, prazos, entregas e status',
  config.personality,
  config.tone_of_voice,
  config.language,
  config.llm_model,
  config.conversation_style,
  config.closing_style,
  config.avoid_repetition,
  config.auto_reply_delay_ms,
  'Você é um agente de atendimento ao cliente especializado em logística. Responda de forma clara e objetiva sobre status de pedidos, prazos de entrega e informações logísticas. Seja empático e profissional.',
  config.custom_instructions,
  config.forbidden_phrases
FROM ai_agent_config config
WHERE config.agent_type = 'customer' AND config.is_active = true
ON CONFLICT DO NOTHING;

-- Atualizar a instância de agente de logística (carrier) para ficar ativa
UPDATE public.ai_agent_instances 
SET is_active = true
WHERE agent_type = 'carrier' AND instance_name = 'Agente Logística';

-- Atualizar carriers existentes que são clientes identificados (Ex: "Contato XXXX" para "Cliente: Nome")
-- Isso corrige registros antigos que ficaram com nome genérico
UPDATE public.carriers c
SET name = 'Cliente: ' || cc.customer_name
FROM public.customer_contacts cc
WHERE (
  c.whatsapp IS NOT NULL 
  AND cc.whatsapp IS NOT NULL 
  AND c.name LIKE 'Contato %'
  AND (
    c.whatsapp LIKE '%' || RIGHT(cc.whatsapp, 8) || '%'
    OR cc.whatsapp LIKE '%' || RIGHT(c.whatsapp, 8) || '%'
  )
);

-- Atualizar contact_type em mensagens existentes que foram identificadas incorretamente
UPDATE public.carrier_conversations cc
SET contact_type = 'customer'
FROM public.carriers car
WHERE cc.carrier_id = car.id 
  AND car.name LIKE 'Cliente: %'
  AND (cc.contact_type IS NULL OR cc.contact_type = 'carrier');