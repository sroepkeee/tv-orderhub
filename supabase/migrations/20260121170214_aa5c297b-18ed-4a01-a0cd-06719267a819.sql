-- ============================================
-- Integração Discord para Notificações Internas
-- ============================================

-- Tabela de configuração de webhooks Discord
CREATE TABLE public.discord_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Tipos de notificação que este canal recebe
  receive_smart_alerts BOOLEAN DEFAULT true,
  receive_status_changes BOOLEAN DEFAULT false,
  receive_phase_notifications BOOLEAN DEFAULT true,
  receive_purchase_alerts BOOLEAN DEFAULT true,
  
  -- Filtros opcionais
  min_priority INTEGER DEFAULT 3 CHECK (min_priority BETWEEN 1 AND 3),
  phase_filter TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Tabela de log de notificações Discord
CREATE TABLE public.discord_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_id UUID REFERENCES discord_webhooks(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  message_content JSONB,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_discord_webhooks_org ON discord_webhooks(organization_id);
CREATE INDEX idx_discord_webhooks_active ON discord_webhooks(is_active) WHERE is_active = true;
CREATE INDEX idx_discord_notification_log_org ON discord_notification_log(organization_id);
CREATE INDEX idx_discord_notification_log_status ON discord_notification_log(status);
CREATE INDEX idx_discord_notification_log_created ON discord_notification_log(created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_discord_webhooks_updated_at
  BEFORE UPDATE ON discord_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE discord_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_notification_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para discord_webhooks
CREATE POLICY "Users can view org webhooks"
  ON discord_webhooks FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage webhooks"
  ON discord_webhooks FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin(auth.uid())
  );

-- Políticas RLS para discord_notification_log
CREATE POLICY "Users can view org notification logs"
  ON discord_notification_log FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Service role can insert logs"
  ON discord_notification_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update logs"
  ON discord_notification_log FOR UPDATE
  USING (true);