-- Adicionar coluna para múltiplos números de teste
ALTER TABLE ai_agent_config 
ADD COLUMN IF NOT EXISTS test_phones TEXT[] DEFAULT '{}';

-- Migrar número existente para o novo array (se ainda não migrado)
UPDATE ai_agent_config 
SET test_phones = ARRAY[test_phone]
WHERE test_phone IS NOT NULL 
  AND test_phone != ''
  AND (test_phones IS NULL OR test_phones = '{}');