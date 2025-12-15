-- Inserir configuração para agente de clientes
INSERT INTO public.ai_agent_config (
  agent_type,
  agent_name,
  personality,
  tone_of_voice,
  language,
  is_active,
  whatsapp_enabled,
  email_enabled,
  auto_reply_enabled,
  signature,
  custom_instructions,
  respect_working_hours,
  max_notifications_per_day,
  min_interval_minutes,
  working_hours_start,
  working_hours_end
)
SELECT 
  'customer',
  'Assistente Imply - Clientes',
  'Atencioso, prestativo e focado na satisfação do cliente. Fornece informações claras sobre pedidos e entregas.',
  'amigavel',
  'pt-BR',
  false,
  true,
  true,
  false,
  'Equipe Imply - Atendimento ao Cliente',
  'Você é um assistente de atendimento ao cliente da Imply. Foque em informar status de pedidos e entregas, responder dúvidas sobre produtos e serviços, encaminhar para suporte humano quando necessário, ser empático e profissional.',
  true,
  5,
  60,
  '08:00:00',
  '18:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agent_config WHERE agent_type = 'customer'
);