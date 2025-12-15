-- Add notification phases field to ai_agent_config
ALTER TABLE public.ai_agent_config 
ADD COLUMN IF NOT EXISTS notification_phases text[] DEFAULT ARRAY['in_transit', 'delivered']::text[];

-- Add comment for documentation
COMMENT ON COLUMN public.ai_agent_config.notification_phases IS 'List of status phases that trigger automatic customer notifications';