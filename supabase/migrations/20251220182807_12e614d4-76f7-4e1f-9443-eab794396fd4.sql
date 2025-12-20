-- =============================================
-- FASE 1: Sistema de Relatórios Configurável
-- =============================================

-- Tabela de templates de relatório
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, on_demand, alert
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb, -- quais métricas incluir
  charts JSONB NOT NULL DEFAULT '[]'::jsonb, -- configuração de gráficos
  sections JSONB NOT NULL DEFAULT '[]'::jsonb, -- ordem das seções
  message_template TEXT, -- template da mensagem
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false, -- templates padrão do sistema
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de agendamentos de relatório
CREATE TABLE public.report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly, on_demand
  send_time TIME NOT NULL DEFAULT '08:00:00',
  send_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- dias da semana (1=seg, 7=dom)
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- lista de destinatários com whatsapp
  include_charts BOOLEAN NOT NULL DEFAULT true,
  chart_provider TEXT NOT NULL DEFAULT 'quickchart', -- quickchart, ai
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações de gráficos
CREATE TABLE public.chart_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chart_type TEXT NOT NULL DEFAULT 'bar', -- bar, pie, line, gauge, doughnut, radar
  data_source TEXT NOT NULL, -- phase_distribution, sla_compliance, weekly_trend, etc
  colors JSONB NOT NULL DEFAULT '["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]'::jsonb,
  options JSONB NOT NULL DEFAULT '{}'::jsonb, -- opções específicas do gráfico
  width INTEGER NOT NULL DEFAULT 500,
  height INTEGER NOT NULL DEFAULT 300,
  background_color TEXT DEFAULT '#ffffff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de envio de relatórios
CREATE TABLE public.report_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
  recipient_whatsapp TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  message_content TEXT,
  charts_sent INTEGER DEFAULT 0,
  error_message TEXT,
  metrics_snapshot JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX idx_report_templates_org ON public.report_templates(organization_id);
CREATE INDEX idx_report_schedules_org ON public.report_schedules(organization_id);
CREATE INDEX idx_report_schedules_next_send ON public.report_schedules(next_send_at) WHERE is_active = true;
CREATE INDEX idx_chart_configs_org ON public.chart_configs(organization_id);
CREATE INDEX idx_report_send_log_org ON public.report_send_log(organization_id);
CREATE INDEX idx_report_send_log_schedule ON public.report_send_log(schedule_id);

-- Enable RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_send_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies para report_templates
CREATE POLICY "Org users can view their report templates"
  ON public.report_templates FOR SELECT
  USING (organization_id = get_user_organization_id() OR is_system = true);

CREATE POLICY "Org admins can manage report templates"
  ON public.report_templates FOR ALL
  USING (organization_id = get_user_organization_id() AND is_org_admin())
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin());

-- RLS Policies para report_schedules
CREATE POLICY "Org users can view their report schedules"
  ON public.report_schedules FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can manage report schedules"
  ON public.report_schedules FOR ALL
  USING (organization_id = get_user_organization_id() AND is_org_admin())
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin());

-- RLS Policies para chart_configs
CREATE POLICY "Org users can view their chart configs"
  ON public.chart_configs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can manage chart configs"
  ON public.chart_configs FOR ALL
  USING (organization_id = get_user_organization_id() AND is_org_admin())
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin());

-- RLS Policies para report_send_log
CREATE POLICY "Org admins can view report send log"
  ON public.report_send_log FOR SELECT
  USING (organization_id = get_user_organization_id() AND is_org_admin());

CREATE POLICY "System can insert report send log"
  ON public.report_send_log FOR INSERT
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chart_configs_updated_at
  BEFORE UPDATE ON public.chart_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão do sistema
INSERT INTO public.report_templates (name, description, report_type, is_system, metrics, charts, sections, message_template)
VALUES 
(
  'Relatório Diário Executivo',
  'Resumo diário com métricas principais e gráficos',
  'daily',
  true,
  '["total_orders", "total_value", "new_today", "sla_ontime", "sla_late", "phase_distribution"]'::jsonb,
  '[{"type": "pie", "data_source": "phase_distribution"}, {"type": "gauge", "data_source": "sla_compliance"}]'::jsonb,
  '["header", "summary", "sla", "phases", "alerts", "top_orders"]'::jsonb,
  '📊 *Relatório Diário - {{date}}*

📦 *Pedidos Ativos:* {{total_orders}}
💰 *Valor Total:* {{total_value}}
🆕 *Novos Hoje:* {{new_today}}

📈 *SLA:*
✅ No prazo: {{sla_ontime}} ({{sla_ontime_pct}}%)
⚠️ Atrasados: {{sla_late}} ({{sla_late_pct}}%)

{{phase_summary}}

{{alerts}}'
),
(
  'Alerta de Gargalo',
  'Notificação quando há gargalos detectados',
  'alert',
  true,
  '["bottlenecks", "phase_time"]'::jsonb,
  '[]'::jsonb,
  '["alert_header", "bottleneck_details"]'::jsonb,
  '🚨 *Alerta de Gargalo Detectado*

📍 *Fase:* {{phase_name}}
⏱️ *Tempo médio:* {{avg_time}} dias
📦 *Pedidos afetados:* {{affected_orders}}

{{details}}'
),
(
  'Comparativo Semanal',
  'Comparação entre semana atual e anterior',
  'weekly',
  true,
  '["weekly_orders", "weekly_value", "weekly_sla", "weekly_trend"]'::jsonb,
  '[{"type": "bar", "data_source": "weekly_comparison"}]'::jsonb,
  '["header", "comparison", "trends", "highlights"]'::jsonb,
  '📊 *Relatório Semanal*
Período: {{week_start}} a {{week_end}}

📦 *Volume:* {{current_orders}} ({{volume_trend}})
💰 *Valor:* {{current_value}} ({{value_trend}})
✅ *SLA:* {{current_sla}}% ({{sla_trend}})

{{comparison_details}}'
),
(
  'SLA por Cliente',
  'Análise de SLA segmentado por cliente',
  'on_demand',
  true,
  '["customer_sla", "customer_volume"]'::jsonb,
  '[{"type": "bar", "data_source": "customer_sla"}]'::jsonb,
  '["header", "customer_ranking", "details"]'::jsonb,
  '📊 *Análise SLA por Cliente*

{{customer_ranking}}

{{sla_details}}'
);

-- Inserir configurações de gráfico padrão
INSERT INTO public.chart_configs (name, chart_type, data_source, colors, width, height)
VALUES 
(
  'Distribuição por Fase',
  'pie',
  'phase_distribution',
  '["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]'::jsonb,
  500,
  300
),
(
  'Gauge de SLA',
  'gauge',
  'sla_compliance',
  '["#ef4444", "#f59e0b", "#10b981"]'::jsonb,
  400,
  200
),
(
  'Tendência Semanal',
  'bar',
  'weekly_trend',
  '["#3b82f6", "#10b981"]'::jsonb,
  600,
  300
),
(
  'SLA por Cliente',
  'bar',
  'customer_sla',
  '["#10b981", "#ef4444"]'::jsonb,
  600,
  400
);