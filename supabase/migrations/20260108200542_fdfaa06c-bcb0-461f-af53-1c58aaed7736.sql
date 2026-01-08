-- Remover constraint única que impede novo registro para contato com registro já processado
ALTER TABLE pending_ai_replies DROP CONSTRAINT IF EXISTS unique_pending_reply_per_contact;

-- Criar índice parcial que só considera registros NÃO processados
-- Isso permite ter múltiplos registros históricos (processados) mas apenas um pendente por contato
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_unprocessed_reply 
ON pending_ai_replies (carrier_id, sender_phone) 
WHERE processed_at IS NULL;