-- 1. Inserir gestores que estão em profiles.is_manager=true mas não em management_report_recipients
INSERT INTO management_report_recipients (user_id, whatsapp, is_active, report_types)
SELECT 
  p.id,
  p.whatsapp,
  true,
  ARRAY['daily', 'alerts']
FROM profiles p
LEFT JOIN management_report_recipients mrr ON mrr.user_id = p.id
WHERE p.is_manager = true 
  AND mrr.id IS NULL
  AND p.whatsapp IS NOT NULL;

-- 2. Ativar gestores que estão is_active=false mas deveriam estar ativos
UPDATE management_report_recipients mrr
SET is_active = true
FROM profiles p
WHERE mrr.user_id = p.id 
  AND p.is_manager = true;

-- 3. Normalizar WhatsApp (adicionar 55 se necessário)
UPDATE management_report_recipients
SET whatsapp = '55' || whatsapp
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 11 
  AND whatsapp NOT LIKE '55%';

-- 4. Criar função de sincronização automática
CREATE OR REPLACE FUNCTION public.sync_manager_to_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se is_manager mudou para TRUE
  IF NEW.is_manager = true AND (OLD.is_manager = false OR OLD.is_manager IS NULL) THEN
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

-- 5. Criar trigger para sincronização automática
DROP TRIGGER IF EXISTS trigger_sync_manager_recipients ON profiles;
CREATE TRIGGER trigger_sync_manager_recipients
AFTER UPDATE OF is_manager ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_manager_to_recipients();