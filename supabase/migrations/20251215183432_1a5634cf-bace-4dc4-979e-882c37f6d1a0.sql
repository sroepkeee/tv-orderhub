-- Add 'invoicing' phase to notification_phases for customer agent
UPDATE ai_agent_config 
SET notification_phases = ARRAY['order_created', 'in_transit', 'delivered', 'delayed', 'invoicing']
WHERE agent_type = 'customer';