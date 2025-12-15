-- Add columns for group message support
ALTER TABLE carrier_conversations 
ADD COLUMN IF NOT EXISTS is_group_message boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_id text,
ADD COLUMN IF NOT EXISTS group_name text;

-- Create index for group filtering
CREATE INDEX IF NOT EXISTS idx_carrier_conversations_group ON carrier_conversations(is_group_message, group_id);

-- Enable realtime for carrier_conversations if not already
ALTER TABLE carrier_conversations REPLICA IDENTITY FULL;