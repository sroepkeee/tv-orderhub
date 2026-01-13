-- Limpar instâncias duplicadas/órfãs do WhatsApp
-- Desativar instâncias não utilizadas (mantendo apenas a principal)
UPDATE whatsapp_instances 
SET is_active = false, 
    status = 'inactive',
    updated_at = NOW()
WHERE instance_key NOT IN (
  SELECT instance_key 
  FROM whatsapp_instances 
  WHERE is_active = true 
  ORDER BY connected_at DESC NULLS LAST 
  LIMIT 1
);

-- Resetar status da instância principal ativa para permitir reconexão limpa
UPDATE whatsapp_instances 
SET status = 'waiting_scan',
    connected_at = NULL,
    updated_at = NOW()
WHERE is_active = true 
  AND status != 'connected';