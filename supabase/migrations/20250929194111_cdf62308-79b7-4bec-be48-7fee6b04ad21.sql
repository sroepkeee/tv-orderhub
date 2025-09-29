-- Add new columns to orders table for item tracking and delivery status
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS item_code TEXT,
ADD COLUMN IF NOT EXISTS item_description TEXT,
ADD COLUMN IF NOT EXISTS requested_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';

-- Add comment to clarify delivery_status values
COMMENT ON COLUMN public.orders.delivery_status IS 'Values: pending, complete, partial';