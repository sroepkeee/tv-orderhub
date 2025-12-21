-- Sprint 2: Triggers de propagação automática (PARTE 2)

-- ============================================
-- Trigger para whatsapp_media (via conversation_id)
-- ============================================
CREATE OR REPLACE FUNCTION propagate_whatsapp_media_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT c.organization_id INTO NEW.organization_id
    FROM carrier_conversations cc
    JOIN carriers c ON cc.carrier_id = c.id
    WHERE cc.id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_whatsapp_media_org ON whatsapp_media;
CREATE TRIGGER set_whatsapp_media_org
  BEFORE INSERT ON whatsapp_media
  FOR EACH ROW
  EXECUTE FUNCTION propagate_whatsapp_media_org();

-- ============================================
-- Trigger para freight_quotes
-- ============================================
CREATE OR REPLACE FUNCTION propagate_freight_quotes_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF NEW.carrier_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM carriers WHERE id = NEW.carrier_id;
    END IF;
    
    IF NEW.organization_id IS NULL AND NEW.order_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM orders WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_freight_quotes_org ON freight_quotes;
CREATE TRIGGER set_freight_quotes_org
  BEFORE INSERT ON freight_quotes
  FOR EACH ROW
  EXECUTE FUNCTION propagate_freight_quotes_org();

-- ============================================
-- Trigger para freight_quote_responses
-- ============================================
CREATE OR REPLACE FUNCTION propagate_freight_quote_responses_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM freight_quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_freight_quote_responses_org ON freight_quote_responses;
CREATE TRIGGER set_freight_quote_responses_org
  BEFORE INSERT ON freight_quote_responses
  FOR EACH ROW
  EXECUTE FUNCTION propagate_freight_quote_responses_org();

-- ============================================
-- Trigger para stock_movements
-- ============================================
CREATE OR REPLACE FUNCTION propagate_stock_movements_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_stock_movements_org ON stock_movements;
CREATE TRIGGER set_stock_movements_org
  BEFORE INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION propagate_stock_movements_org();

-- ============================================
-- Trigger para message_queue
-- ============================================
CREATE OR REPLACE FUNCTION propagate_message_queue_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_user_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_message_queue_org ON message_queue;
CREATE TRIGGER set_message_queue_org
  BEFORE INSERT ON message_queue
  FOR EACH ROW
  EXECUTE FUNCTION propagate_message_queue_org();

-- ============================================
-- Trigger para whatsapp_message_log (via conversation_id)
-- ============================================
CREATE OR REPLACE FUNCTION propagate_whatsapp_message_log_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT c.organization_id INTO NEW.organization_id
    FROM carrier_conversations cc
    JOIN carriers c ON cc.carrier_id = c.id
    WHERE cc.id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_whatsapp_message_log_org ON whatsapp_message_log;
CREATE TRIGGER set_whatsapp_message_log_org
  BEFORE INSERT ON whatsapp_message_log
  FOR EACH ROW
  EXECUTE FUNCTION propagate_whatsapp_message_log_org();

-- ============================================
-- PENDING_AI_REPLIES - Corrigir trigger (herda de carriers)
-- ============================================
CREATE OR REPLACE FUNCTION propagate_pending_ai_replies_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.carrier_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM carriers WHERE id = NEW.carrier_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pending_ai_replies_org ON pending_ai_replies;
CREATE TRIGGER set_pending_ai_replies_org
  BEFORE INSERT ON pending_ai_replies
  FOR EACH ROW
  EXECUTE FUNCTION propagate_pending_ai_replies_org();