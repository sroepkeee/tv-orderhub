-- Desativar instâncias duplicadas/órfãs - manter apenas a conectada
UPDATE whatsapp_instances 
SET is_active = false, 
    status = 'inactive',
    updated_at = NOW()
WHERE status = 'waiting_scan' 
   OR (is_active = true AND status != 'connected');

-- Garantir apenas UMA instância ativa por organização
WITH ranked_instances AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY connected_at DESC NULLS LAST) as rn
  FROM whatsapp_instances
  WHERE is_active = true
)
UPDATE whatsapp_instances 
SET is_active = false, status = 'inactive', updated_at = NOW()
WHERE id IN (SELECT id FROM ranked_instances WHERE rn > 1);