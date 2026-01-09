-- Sincronizar WhatsApp de profiles para phase_managers onde está vazio
UPDATE phase_managers pm
SET whatsapp = p.whatsapp
FROM profiles p
WHERE pm.user_id = p.id
  AND (pm.whatsapp IS NULL OR pm.whatsapp = '')
  AND p.whatsapp IS NOT NULL 
  AND p.whatsapp != '';