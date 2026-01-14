-- Adicionar colunas para suportar diferentes tipos de destinatários
ALTER TABLE public.report_schedules 
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'managers';
-- 'managers' = gestores, 'customers' = clientes

ALTER TABLE public.report_schedules 
ADD COLUMN IF NOT EXISTS customer_notification_phases TEXT[] DEFAULT '{}';
-- Fases habilitadas para clientes (ex: ['in_transit', 'delivered'])

ALTER TABLE public.report_schedules 
ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'full';
-- Tipo do relatório: 'full', 'summary', 'urgent', 'delayed', 'phase_summary'

-- Comentários para documentação
COMMENT ON COLUMN public.report_schedules.recipient_type IS 'Tipo de destinatário: managers (gestores) ou customers (clientes)';
COMMENT ON COLUMN public.report_schedules.customer_notification_phases IS 'Fases de notificação para clientes (ex: in_transit, delivered)';
COMMENT ON COLUMN public.report_schedules.report_type IS 'Tipo de relatório: full, summary, urgent, delayed, phase_summary';