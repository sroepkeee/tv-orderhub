-- =====================================================
-- 1. Adicionar organization_id em pending_ai_replies (se não existir)
-- =====================================================
ALTER TABLE pending_ai_replies ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Backfill organization_id a partir do carrier
UPDATE pending_ai_replies par
SET organization_id = c.organization_id
FROM carriers c
WHERE par.carrier_id = c.id AND par.organization_id IS NULL;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_pending_ai_replies_org ON pending_ai_replies(organization_id) WHERE processed_at IS NULL;

-- =====================================================
-- 2. Função de normalização de WhatsApp (Brasil)
-- PRESERVA valor original se não conseguir normalizar
-- =====================================================
CREATE OR REPLACE FUNCTION normalize_brazil_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  cleaned text;
  len int;
BEGIN
  -- Se null ou vazio, retornar o original
  IF phone IS NULL OR trim(phone) = '' THEN
    RETURN phone;
  END IF;
  
  -- Remove tudo que não é dígito
  cleaned := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Se ficou vazio após limpeza, retornar original
  IF cleaned = '' THEN
    RETURN phone;
  END IF;
  
  len := length(cleaned);
  
  -- Casos de normalização para Brasil:
  CASE len
    WHEN 10 THEN
      -- DDD + 8 dígitos -> adicionar 55 e 9 após DDD
      -- Ex: 5189158486 -> 5551989158486
      RETURN '55' || substring(cleaned, 1, 2) || '9' || substring(cleaned, 3);
    WHEN 11 THEN
      -- DDD + 9 + 8 dígitos -> adicionar 55
      -- Ex: 51989158486 -> 5551989158486
      RETURN '55' || cleaned;
    WHEN 12 THEN
      -- 55 + DDD + 8 dígitos -> adicionar 9 após DDD
      -- Ex: 555189158486 -> 5551989158486
      IF substring(cleaned, 1, 2) = '55' THEN
        RETURN '55' || substring(cleaned, 3, 2) || '9' || substring(cleaned, 5);
      END IF;
    WHEN 13 THEN
      -- Já está completo, retornar limpo
      RETURN cleaned;
    ELSE
      -- Outros casos: retornar apenas os dígitos limpos
      RETURN cleaned;
  END CASE;
  
  -- Fallback: retornar limpo
  RETURN cleaned;
END;
$$;

-- =====================================================
-- 3. Trigger para normalizar WhatsApp ao salvar
-- =====================================================
CREATE OR REPLACE FUNCTION normalize_whatsapp_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normalizar campo whatsapp se existir
  IF TG_TABLE_NAME = 'customer_contacts' THEN
    NEW.whatsapp := normalize_brazil_phone(NEW.whatsapp);
    NEW.phone := normalize_brazil_phone(NEW.phone);
  ELSIF TG_TABLE_NAME = 'carriers' THEN
    NEW.whatsapp := normalize_brazil_phone(NEW.whatsapp);
    NEW.phone := normalize_brazil_phone(NEW.phone);
  ELSIF TG_TABLE_NAME = 'orders' THEN
    NEW.customer_whatsapp := normalize_brazil_phone(NEW.customer_whatsapp);
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    NEW.whatsapp := normalize_brazil_phone(NEW.whatsapp);
  ELSIF TG_TABLE_NAME = 'phase_managers' THEN
    NEW.whatsapp := normalize_brazil_phone(NEW.whatsapp);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar triggers nas tabelas principais
DROP TRIGGER IF EXISTS normalize_customer_contacts_whatsapp ON customer_contacts;
CREATE TRIGGER normalize_customer_contacts_whatsapp
  BEFORE INSERT OR UPDATE ON customer_contacts
  FOR EACH ROW EXECUTE FUNCTION normalize_whatsapp_on_save();

DROP TRIGGER IF EXISTS normalize_carriers_whatsapp ON carriers;
CREATE TRIGGER normalize_carriers_whatsapp
  BEFORE INSERT OR UPDATE ON carriers
  FOR EACH ROW EXECUTE FUNCTION normalize_whatsapp_on_save();

DROP TRIGGER IF EXISTS normalize_orders_whatsapp ON orders;
CREATE TRIGGER normalize_orders_whatsapp
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION normalize_whatsapp_on_save();

DROP TRIGGER IF EXISTS normalize_profiles_whatsapp ON profiles;
CREATE TRIGGER normalize_profiles_whatsapp
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_whatsapp_on_save();

DROP TRIGGER IF EXISTS normalize_phase_managers_whatsapp ON phase_managers;
CREATE TRIGGER normalize_phase_managers_whatsapp
  BEFORE INSERT OR UPDATE ON phase_managers
  FOR EACH ROW EXECUTE FUNCTION normalize_whatsapp_on_save();

-- =====================================================
-- 4. Backfill: normalizar dados existentes
-- =====================================================
UPDATE customer_contacts 
SET whatsapp = normalize_brazil_phone(whatsapp),
    phone = normalize_brazil_phone(phone)
WHERE whatsapp IS NOT NULL OR phone IS NOT NULL;

UPDATE carriers 
SET whatsapp = normalize_brazil_phone(whatsapp),
    phone = normalize_brazil_phone(phone)
WHERE whatsapp IS NOT NULL OR phone IS NOT NULL;

UPDATE orders 
SET customer_whatsapp = normalize_brazil_phone(customer_whatsapp)
WHERE customer_whatsapp IS NOT NULL;

UPDATE profiles 
SET whatsapp = normalize_brazil_phone(whatsapp)
WHERE whatsapp IS NOT NULL;

UPDATE phase_managers 
SET whatsapp = normalize_brazil_phone(whatsapp)
WHERE whatsapp IS NOT NULL;

-- =====================================================
-- 5. Corrigir trigger propagate_pending_ai_replies_org
-- =====================================================
CREATE OR REPLACE FUNCTION propagate_pending_ai_replies_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Agora a coluna organization_id existe
  IF NEW.organization_id IS NULL AND NEW.carrier_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM carriers WHERE id = NEW.carrier_id;
  END IF;
  RETURN NEW;
END;
$$;