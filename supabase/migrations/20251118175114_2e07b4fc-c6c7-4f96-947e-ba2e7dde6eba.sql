-- Add 'purchase_requested' to item_status check constraint
-- Description: Allows 'purchase_requested' status for order items that have purchase action started

-- Step 1: Drop old constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS check_item_status;

-- Step 2: Create new constraint with 'purchase_requested' included
ALTER TABLE order_items 
ADD CONSTRAINT check_item_status 
CHECK (item_status IN (
  'pending',
  'in_stock', 
  'awaiting_production', 
  'purchase_required',
  'purchase_requested',
  'completed'
));

-- Step 3: Add documentation comment
COMMENT ON CONSTRAINT check_item_status ON order_items IS 
'Valid item statuses: pending (initial), in_stock (available), awaiting_production (manufacturing), purchase_required (needs purchase), purchase_requested (purchase initiated), completed (finished)';