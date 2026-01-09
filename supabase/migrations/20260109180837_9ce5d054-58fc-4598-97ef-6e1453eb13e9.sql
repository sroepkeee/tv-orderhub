-- Add recipient configuration columns to ai_manager_trigger_config
ALTER TABLE ai_manager_trigger_config 
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'phase_managers';

ALTER TABLE ai_manager_trigger_config 
ADD COLUMN IF NOT EXISTS custom_recipients UUID[] DEFAULT '{}';

COMMENT ON COLUMN ai_manager_trigger_config.recipient_type 
IS 'Tipo de destinatário: phase_managers, ai_managers, custom';

COMMENT ON COLUMN ai_manager_trigger_config.custom_recipients 
IS 'Lista de user_ids quando recipient_type = custom';