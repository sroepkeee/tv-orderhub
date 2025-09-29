-- Create order_items table for multiple items per order
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'UND',
  requested_quantity INTEGER NOT NULL DEFAULT 0,
  warehouse TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  delivered_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for order_items
CREATE POLICY "Users can view their own order items" 
ON public.order_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own order items" 
ON public.order_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order items" 
ON public.order_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove old item-related columns from orders table
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS item_code,
DROP COLUMN IF EXISTS item_description,
DROP COLUMN IF EXISTS requested_quantity,
DROP COLUMN IF EXISTS received_quantity,
DROP COLUMN IF EXISTS delivery_status;

-- Add index for better performance when querying items by order
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_user_id ON public.order_items(user_id);