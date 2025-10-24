-- Adicionar novo status 'sent_locally' ao enum de status da tabela freight_quotes
-- Este status indica que a cotação foi registrada localmente mas a tentativa de envio via N8N falhou

COMMENT ON COLUMN public.freight_quotes.status IS 
'Status da cotação: pending (criada), sent (enviada via N8N), sent_locally (registrada mas N8N falhou), responded (transportadora respondeu), accepted (aceita), rejected (rejeitada), expired (expirada)';

-- Não precisa adicionar constraint pois o tipo é text, não enum
-- O status 'sent_locally' pode ser usado normalmente