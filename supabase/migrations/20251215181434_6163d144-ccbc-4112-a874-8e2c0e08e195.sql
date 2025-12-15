-- Add customer_whatsapp to orders table for direct notification
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_whatsapp text;

-- Add test_phone to ai_agent_config for test mode
ALTER TABLE public.ai_agent_config ADD COLUMN IF NOT EXISTS test_phone text;

-- Create index for faster customer lookup
CREATE INDEX IF NOT EXISTS idx_customer_contacts_whatsapp ON public.customer_contacts(whatsapp);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_name ON public.customer_contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_whatsapp ON public.orders(customer_whatsapp);