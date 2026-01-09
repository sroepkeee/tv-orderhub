-- 1. Remover duplicados (se existirem) mantendo o mais recente
DELETE FROM management_report_recipients a
USING management_report_recipients b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- 2. Adicionar constraint UNIQUE em user_id para permitir ON CONFLICT
ALTER TABLE public.management_report_recipients
ADD CONSTRAINT management_report_recipients_user_id_key UNIQUE (user_id);

-- 3. Atualizar função para sincronizar também quando WhatsApp mudar
CREATE OR REPLACE FUNCTION public.sync_manager_to_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se is_manager é TRUE e mudou is_manager ou whatsapp
  IF NEW.is_manager = true AND (
    OLD.is_manager IS DISTINCT FROM NEW.is_manager OR
    OLD.whatsapp IS DISTINCT FROM NEW.whatsapp
  ) THEN
    INSERT INTO management_report_recipients (user_id, whatsapp, is_active, report_types)
    VALUES (NEW.id, NEW.whatsapp, true, ARRAY['daily', 'alerts'])
    ON CONFLICT (user_id) DO UPDATE SET is_active = true, whatsapp = EXCLUDED.whatsapp;
  END IF;
  
  -- Se is_manager mudou para FALSE
  IF NEW.is_manager = false AND OLD.is_manager = true THEN
    UPDATE management_report_recipients SET is_active = false WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Recriar trigger para disparar em is_manager E whatsapp
DROP TRIGGER IF EXISTS trigger_sync_manager_recipients ON profiles;
CREATE TRIGGER trigger_sync_manager_recipients
AFTER UPDATE OF is_manager, whatsapp ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_manager_to_recipients();

-- 5. Backfill: sincronizar todos os gestores existentes
INSERT INTO management_report_recipients (user_id, whatsapp, is_active, report_types)
SELECT p.id, p.whatsapp, true, ARRAY['daily', 'alerts']
FROM profiles p
WHERE p.is_manager = true AND p.whatsapp IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET is_active = true, whatsapp = EXCLUDED.whatsapp;

-- 6. Normalizar WhatsApp existentes na tabela
UPDATE management_report_recipients
SET whatsapp = normalize_brazil_phone(whatsapp)
WHERE whatsapp IS NOT NULL;