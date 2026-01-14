-- Adicionar colunas de rate limiting e controle de envio em ai_agent_config
ALTER TABLE public.ai_agent_config
ADD COLUMN IF NOT EXISTS delay_between_messages_ms integer DEFAULT 3000,
ADD COLUMN IF NOT EXISTS max_messages_per_minute integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS max_messages_per_hour integer DEFAULT 200,
ADD COLUMN IF NOT EXISTS send_window_start time DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS send_window_end time DEFAULT '20:00:00',
ADD COLUMN IF NOT EXISTS respect_send_window boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS queue_outside_window boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS message_style text DEFAULT 'visual',
ADD COLUMN IF NOT EXISTS use_progress_bar boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_greeting text,
ADD COLUMN IF NOT EXISTS custom_closing text;

-- Comentários para documentação
COMMENT ON COLUMN public.ai_agent_config.delay_between_messages_ms IS 'Delay mínimo entre envios consecutivos (ms)';
COMMENT ON COLUMN public.ai_agent_config.max_messages_per_minute IS 'Limite máximo de mensagens por minuto';
COMMENT ON COLUMN public.ai_agent_config.max_messages_per_hour IS 'Limite máximo de mensagens por hora';
COMMENT ON COLUMN public.ai_agent_config.send_window_start IS 'Horário de início da janela de envio';
COMMENT ON COLUMN public.ai_agent_config.send_window_end IS 'Horário de fim da janela de envio';
COMMENT ON COLUMN public.ai_agent_config.respect_send_window IS 'Se deve respeitar a janela de horário comercial';
COMMENT ON COLUMN public.ai_agent_config.queue_outside_window IS 'Se deve enfileirar mensagens fora do horário';
COMMENT ON COLUMN public.ai_agent_config.message_style IS 'Estilo visual das mensagens: visual, simple, minimal';
COMMENT ON COLUMN public.ai_agent_config.use_progress_bar IS 'Se deve mostrar barra de progresso nas mensagens';
COMMENT ON COLUMN public.ai_agent_config.custom_greeting IS 'Saudação personalizada opcional';
COMMENT ON COLUMN public.ai_agent_config.custom_closing IS 'Fechamento personalizado opcional';