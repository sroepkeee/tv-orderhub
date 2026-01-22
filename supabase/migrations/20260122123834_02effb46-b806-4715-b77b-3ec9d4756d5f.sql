-- ================================================================
-- Melhorias Avançadas de Discord para Agentes de IA
-- ================================================================

-- 1. Menções de Roles Discord
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS role_mention_critical text,
ADD COLUMN IF NOT EXISTS role_mention_high text,
ADD COLUMN IF NOT EXISTS enable_role_mentions boolean DEFAULT false;

-- 2. Sistema Digest/Batching
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS enable_digest boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS digest_interval_minutes integer DEFAULT 15;

-- 3. Filtros Avançados
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS filter_customers text[],
ADD COLUMN IF NOT EXISTS filter_phases text[],
ADD COLUMN IF NOT EXISTS filter_min_order_value numeric,
ADD COLUMN IF NOT EXISTS filter_order_types text[];

-- 4. Templates Personalizados
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS template_id uuid;

-- 5. Threads Automáticas
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS enable_auto_threads boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS discord_bot_token text;

-- 6. Relatórios Visuais
ALTER TABLE discord_webhooks
ADD COLUMN IF NOT EXISTS receive_visual_reports boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS visual_report_schedule text;

-- ================================================================
-- Tabela: discord_digest_queue (Sistema de Batching)
-- ================================================================
CREATE TABLE IF NOT EXISTS discord_digest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_id uuid REFERENCES discord_webhooks(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  notifications jsonb[] DEFAULT '{}',
  scheduled_for timestamptz NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices para digest queue
CREATE INDEX IF NOT EXISTS idx_discord_digest_queue_scheduled 
ON discord_digest_queue(scheduled_for) WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_discord_digest_queue_org 
ON discord_digest_queue(organization_id);

-- RLS para discord_digest_queue
ALTER TABLE discord_digest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org digest queue"
ON discord_digest_queue FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Service role can manage digest queue"
ON discord_digest_queue FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- Tabela: discord_message_templates (Templates Personalizados)
-- ================================================================
CREATE TABLE IF NOT EXISTS discord_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  notification_types text[],
  embed_color text,
  title_prefix text,
  footer_text text,
  show_order_link boolean DEFAULT true,
  show_timestamp boolean DEFAULT true,
  custom_fields jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para templates
CREATE INDEX IF NOT EXISTS idx_discord_templates_org 
ON discord_message_templates(organization_id);

-- RLS para discord_message_templates
ALTER TABLE discord_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org templates"
ON discord_message_templates FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage templates"
ON discord_message_templates FOR ALL
USING (is_org_admin())
WITH CHECK (is_org_admin());

-- ================================================================
-- Tabela: discord_order_threads (Threads Automáticas)
-- ================================================================
CREATE TABLE IF NOT EXISTS discord_order_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  order_number text,
  webhook_id uuid REFERENCES discord_webhooks(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  thread_name text,
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz
);

-- Índices para order threads
CREATE INDEX IF NOT EXISTS idx_discord_order_threads_order 
ON discord_order_threads(order_id, webhook_id);

CREATE INDEX IF NOT EXISTS idx_discord_order_threads_org 
ON discord_order_threads(organization_id);

-- RLS para discord_order_threads
ALTER TABLE discord_order_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org threads"
ON discord_order_threads FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Service role can manage threads"
ON discord_order_threads FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- FK para template_id em discord_webhooks
-- ================================================================
DO $$ BEGIN
  ALTER TABLE discord_webhooks
  ADD CONSTRAINT discord_webhooks_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES discord_message_templates(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;