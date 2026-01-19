-- Add test_mode_enabled column to ai_agent_config
ALTER TABLE ai_agent_config 
ADD COLUMN IF NOT EXISTS test_mode_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN ai_agent_config.test_mode_enabled IS 
'Quando TRUE, notificações são enviadas APENAS para test_phones (modo teste). Quando FALSE, notificações vão para o cliente real.';

-- Add user's number to test_phones for customer agent
UPDATE ai_agent_config 
SET test_phones = array_append(COALESCE(test_phones, '{}'), '5551995938019')
WHERE agent_type = 'customer' 
  AND NOT ('5551995938019' = ANY(COALESCE(test_phones, '{}')));