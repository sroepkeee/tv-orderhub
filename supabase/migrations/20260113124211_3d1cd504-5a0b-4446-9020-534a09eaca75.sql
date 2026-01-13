-- Adicionar coluna api_token na tabela whatsapp_instances
-- Permite armazenar tokens específicos por instância
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS api_token TEXT;

-- Comentário explicativo
COMMENT ON COLUMN whatsapp_instances.api_token IS 'Token de autenticação da API para esta instância específica';