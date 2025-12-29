-- Add support for order-based returns (not only dispatch-based)
-- Allows technicians to request returns directly from orders

-- Make dispatch_id and technician_id nullable (to support order-based returns)
ALTER TABLE return_requests ALTER COLUMN dispatch_id DROP NOT NULL;
ALTER TABLE return_requests ALTER COLUMN technician_id DROP NOT NULL;

-- Add order_id to link directly to orders
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- Add requester_profile_id to link to the profile requesting the return
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS requester_profile_id UUID REFERENCES profiles(id);

-- Add customer info for identification
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS customer_document TEXT;

-- Add order_item_id to return_request_items
ALTER TABLE return_request_items ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id);

-- Make dispatch_item_id nullable (for order-based returns)
ALTER TABLE return_request_items ALTER COLUMN dispatch_item_id DROP NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_request_items_order_item_id ON return_request_items(order_item_id);