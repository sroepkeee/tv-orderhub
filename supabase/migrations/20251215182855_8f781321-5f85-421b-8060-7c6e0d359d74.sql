
-- Configure test phone for customer agent
UPDATE ai_agent_config 
SET test_phone = '5551999050190' 
WHERE agent_type = 'customer';

-- Link test customer to latest order and set WhatsApp
UPDATE customer_contacts 
SET last_order_id = '81d81bd1-cb2b-47be-a803-53b785fbb2e4',
    whatsapp = '5551999050190'
WHERE id = '07afac08-4960-4c60-a0a6-ddf0e9da1d69';

-- Also set customer_whatsapp directly on the order for fallback
UPDATE orders 
SET customer_whatsapp = '5551999050190' 
WHERE id = '81d81bd1-cb2b-47be-a803-53b785fbb2e4';
