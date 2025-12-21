-- Sprint 2: Corrigir vulnerabilidades críticas (PARTE 1)
-- Adicionar coluna organization_id primeiro às tabelas que ainda não têm

-- ============================================
-- WHATSAPP_MEDIA - Adicionar coluna organization_id
-- ============================================
ALTER TABLE whatsapp_media ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Popular dados existentes herdando de carrier_conversations -> carriers
UPDATE whatsapp_media wm 
SET organization_id = c.organization_id
FROM carrier_conversations cc
JOIN carriers c ON cc.carrier_id = c.id
WHERE wm.conversation_id = cc.id AND wm.organization_id IS NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_org ON whatsapp_media(organization_id);

-- Remover políticas permissivas existentes
DROP POLICY IF EXISTS "Authenticated users can view media" ON whatsapp_media;
DROP POLICY IF EXISTS "System can insert media" ON whatsapp_media;
DROP POLICY IF EXISTS "System can update media" ON whatsapp_media;

-- Criar políticas com isolamento
CREATE POLICY "Org users can view whatsapp media" ON whatsapp_media
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create whatsapp media" ON whatsapp_media
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update whatsapp media" ON whatsapp_media
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can delete whatsapp media" ON whatsapp_media
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin());

-- ============================================
-- FREIGHT_QUOTES - Adicionar organization_id
-- ============================================
ALTER TABLE freight_quotes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

UPDATE freight_quotes fq 
SET organization_id = c.organization_id
FROM carriers c 
WHERE fq.carrier_id = c.id AND fq.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_org ON freight_quotes(organization_id);

DROP POLICY IF EXISTS "Authenticated users can view quotes" ON freight_quotes;
DROP POLICY IF EXISTS "Authenticated users can create quotes" ON freight_quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON freight_quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON freight_quotes;

CREATE POLICY "Org users can view freight quotes" ON freight_quotes
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create freight quotes" ON freight_quotes
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update freight quotes" ON freight_quotes
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete freight quotes" ON freight_quotes
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin());

-- ============================================
-- FREIGHT_QUOTE_RESPONSES - Adicionar organization_id
-- ============================================
ALTER TABLE freight_quote_responses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

UPDATE freight_quote_responses fqr 
SET organization_id = fq.organization_id
FROM freight_quotes fq 
WHERE fqr.quote_id = fq.id AND fqr.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quote_responses_org ON freight_quote_responses(organization_id);

DROP POLICY IF EXISTS "Authenticated users can view responses" ON freight_quote_responses;
DROP POLICY IF EXISTS "System can insert responses" ON freight_quote_responses;
DROP POLICY IF EXISTS "Authenticated users can update responses" ON freight_quote_responses;
DROP POLICY IF EXISTS "Authenticated users can delete responses" ON freight_quote_responses;

CREATE POLICY "Org users can view quote responses" ON freight_quote_responses
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create quote responses" ON freight_quote_responses
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update quote responses" ON freight_quote_responses
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete quote responses" ON freight_quote_responses
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin());

-- ============================================
-- STOCK_MOVEMENTS - Adicionar organization_id
-- ============================================
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

UPDATE stock_movements sm 
SET organization_id = o.organization_id
FROM orders o 
WHERE sm.order_id = o.id AND sm.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(organization_id);

DROP POLICY IF EXISTS "Authenticated users can view movements" ON stock_movements;
DROP POLICY IF EXISTS "Authenticated users can insert movements" ON stock_movements;
DROP POLICY IF EXISTS "Authenticated users can update movements" ON stock_movements;

CREATE POLICY "Org users can view stock movements" ON stock_movements
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create stock movements" ON stock_movements
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update stock movements" ON stock_movements
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete stock movements" ON stock_movements
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin());

-- ============================================
-- MESSAGE_QUEUE - Adicionar organization_id
-- ============================================
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_message_queue_org ON message_queue(organization_id);

DROP POLICY IF EXISTS "System can manage message queue" ON message_queue;
DROP POLICY IF EXISTS "Admins can view message queue" ON message_queue;

CREATE POLICY "Org admins can view message queue" ON message_queue
  FOR SELECT USING (
    (organization_id = get_user_organization_id() AND is_org_admin())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org users can create queue messages" ON message_queue
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org admins can update queue messages" ON message_queue
  FOR UPDATE USING (
    (organization_id = get_user_organization_id() AND is_org_admin())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org admins can delete queue messages" ON message_queue
  FOR DELETE USING (
    (organization_id = get_user_organization_id() AND is_org_admin())
    OR has_role(auth.uid(), 'admin')
  );

-- ============================================
-- MESSAGE_QUEUE_STATS - Adicionar organization_id
-- ============================================
ALTER TABLE message_queue_stats ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_message_queue_stats_org ON message_queue_stats(organization_id);

DROP POLICY IF EXISTS "Admins can view stats" ON message_queue_stats;

CREATE POLICY "Org admins can view queue stats" ON message_queue_stats
  FOR SELECT USING (
    (organization_id = get_user_organization_id() AND is_org_admin())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System can manage queue stats" ON message_queue_stats
  FOR ALL USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- ============================================
-- WHATSAPP_MESSAGE_LOG - Adicionar organization_id
-- ============================================
ALTER TABLE whatsapp_message_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

UPDATE whatsapp_message_log wml 
SET organization_id = c.organization_id
FROM carrier_conversations cc
JOIN carriers c ON cc.carrier_id = c.id
WHERE wml.conversation_id = cc.id AND wml.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_log_org ON whatsapp_message_log(organization_id);

DROP POLICY IF EXISTS "Authenticated users can view logs" ON whatsapp_message_log;
DROP POLICY IF EXISTS "System can insert logs" ON whatsapp_message_log;

CREATE POLICY "Org users can view whatsapp logs" ON whatsapp_message_log
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create whatsapp logs" ON whatsapp_message_log
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);