-- Add is_active column to whatsapp_instances
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Set all existing instances to active
UPDATE whatsapp_instances 
SET is_active = true 
WHERE is_active IS NULL;