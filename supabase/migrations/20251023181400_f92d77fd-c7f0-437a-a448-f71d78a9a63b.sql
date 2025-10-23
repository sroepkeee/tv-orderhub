-- Migration: Add 'pending' to item_status check constraint
-- Description: Allows 'pending' status for order items

-- Step 1: Drop old constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS check_item_status;

-- Step 2: Create new constraint with 'pending' included
ALTER TABLE order_items 
ADD CONSTRAINT check_item_status 
CHECK (item_status IN (
  'pending',
  'in_stock', 
  'awaiting_production', 
  'purchase_required', 
  'completed'
));