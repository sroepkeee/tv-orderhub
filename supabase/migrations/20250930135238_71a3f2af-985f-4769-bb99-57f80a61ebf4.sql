-- Create order_comments table
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view comments on their own orders" 
ON public.order_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_comments.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create comments on their own orders" 
ON public.order_comments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_comments.order_id 
    AND orders.user_id = auth.uid()
  )
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own comments" 
ON public.order_comments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.order_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_comments_updated_at
BEFORE UPDATE ON public.order_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for order_comments
ALTER TABLE public.order_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_comments;