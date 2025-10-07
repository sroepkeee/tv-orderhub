-- Step 1: Update RLS policies for shared viewing of orders
-- Drop existing SELECT policy for orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Create new policy allowing all authenticated users to view all orders
CREATE POLICY "All authenticated users can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (true);

-- Step 2: Update RLS policies for order_items
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;

-- Create new policy allowing all authenticated users to view all order items
CREATE POLICY "All authenticated users can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (true);

-- Step 3: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Step 4: Enable realtime for orders table (if not already enabled)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  -- Check if publication exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add orders table to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;