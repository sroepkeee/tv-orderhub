-- Tabela de fila de mensagens WhatsApp
CREATE TABLE public.message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_whatsapp TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'general', -- 'daily_report', 'weekly_report', 'alert', 'sla_warning', 'delayed_order', 'large_order', 'manual'
  message_content TEXT NOT NULL,
  media_base64 TEXT, -- Para imagens/gráficos
  media_caption TEXT,
  media_filename TEXT,
  priority INTEGER NOT NULL DEFAULT 3, -- 1=Crítico, 2=Alto, 3=Normal
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_message_queue_status_priority ON public.message_queue(status, priority, scheduled_for);
CREATE INDEX idx_message_queue_scheduled ON public.message_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_message_queue_recipient ON public.message_queue(recipient_whatsapp);
CREATE INDEX idx_message_queue_type ON public.message_queue(message_type);
CREATE INDEX idx_message_queue_created_at ON public.message_queue(created_at DESC);

-- Enable RLS
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view message queue" ON public.message_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage message queue" ON public.message_queue
  FOR ALL USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_message_queue_updated_at
  BEFORE UPDATE ON public.message_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de métricas de envio
CREATE TABLE public.message_queue_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_queued INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  avg_send_time_ms INTEGER DEFAULT 0,
  messages_per_hour JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stat_date)
);

-- Enable RLS
ALTER TABLE public.message_queue_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stats" ON public.message_queue_stats
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage stats" ON public.message_queue_stats
  FOR ALL USING (true);