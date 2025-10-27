-- Create order_volumes table
CREATE TABLE IF NOT EXISTS public.order_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  volume_number INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC NOT NULL,
  length_cm NUMERIC NOT NULL,
  width_cm NUMERIC NOT NULL,
  height_cm NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_dimensions CHECK (
    weight_kg > 0 AND 
    length_cm > 0 AND 
    width_cm > 0 AND 
    height_cm > 0 AND
    quantity > 0
  ),
  
  CONSTRAINT unique_volume_number UNIQUE (order_id, volume_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_volumes_order_id ON public.order_volumes(order_id);

-- Enable RLS
ALTER TABLE public.order_volumes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view order volumes"
  ON public.order_volumes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage order volumes"
  ON public.order_volumes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_order_volumes_updated_at
  BEFORE UPDATE ON public.order_volumes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();