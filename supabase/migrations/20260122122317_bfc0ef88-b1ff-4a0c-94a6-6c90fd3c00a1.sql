-- Adicionar colunas de filtro para notificações de IA no Discord
ALTER TABLE public.discord_webhooks
ADD COLUMN IF NOT EXISTS receive_ai_customer_notifications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS receive_ai_handoff_alerts boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS receive_freight_quotes boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS receive_delivery_confirmations boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS receive_daily_reports boolean DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.discord_webhooks.receive_ai_customer_notifications IS 'Receber notificações de IA enviadas a clientes';
COMMENT ON COLUMN public.discord_webhooks.receive_ai_handoff_alerts IS 'Receber alertas de handoff de IA para humano';
COMMENT ON COLUMN public.discord_webhooks.receive_freight_quotes IS 'Receber notificações de cotações de frete';
COMMENT ON COLUMN public.discord_webhooks.receive_delivery_confirmations IS 'Receber notificações de confirmação de entrega';
COMMENT ON COLUMN public.discord_webhooks.receive_daily_reports IS 'Receber notificações de relatórios diários';