-- Enable realtime for orders table
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Enable realtime for order_items table
ALTER TABLE public.order_items REPLICA IDENTITY FULL;