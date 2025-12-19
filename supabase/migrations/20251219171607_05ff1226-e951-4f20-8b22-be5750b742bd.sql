-- Tabela de destinatários de relatórios gerenciais
CREATE TABLE public.management_report_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  whatsapp TEXT NOT NULL,
  report_types TEXT[] NOT NULL DEFAULT ARRAY['daily']::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  preferred_time TIME WITHOUT TIME ZONE DEFAULT '08:00:00'::time,
  last_report_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_management_report_recipients_user ON public.management_report_recipients(user_id);
CREATE INDEX idx_management_report_recipients_active ON public.management_report_recipients(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.management_report_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies - apenas admins podem gerenciar
CREATE POLICY "Admins can view report recipients"
  ON public.management_report_recipients
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert report recipients"
  ON public.management_report_recipients
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update report recipients"
  ON public.management_report_recipients
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete report recipients"
  ON public.management_report_recipients
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_management_report_recipients_updated_at
  BEFORE UPDATE ON public.management_report_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para log de relatórios enviados
CREATE TABLE public.management_report_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL DEFAULT 'daily',
  recipient_id UUID REFERENCES public.management_report_recipients(id) ON DELETE SET NULL,
  recipient_whatsapp TEXT NOT NULL,
  message_content TEXT,
  chart_sent BOOLEAN DEFAULT false,
  metrics_snapshot JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.management_report_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view report logs"
  ON public.management_report_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert report logs"
  ON public.management_report_log
  FOR INSERT
  WITH CHECK (true);