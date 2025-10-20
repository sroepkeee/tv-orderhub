-- Criar função de validação para verificar se usuário pode modificar um pedido
CREATE OR REPLACE FUNCTION public.user_can_modify_order(order_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.orders 
    WHERE id = order_uuid 
      AND (user_id = auth.uid() OR order_type = 'ecommerce')
  );
$$;

-- Remover política RLS antiga que valida contra auth.uid()
DROP POLICY IF EXISTS "Authenticated users can upload PDFs" ON storage.objects;

-- Criar nova política RLS que valida usando a função criada
CREATE POLICY "Users can upload PDFs to their orders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments' 
  AND public.user_can_modify_order(((storage.foldername(name))[1])::uuid)
);

-- Política de UPDATE para permitir modificações
DROP POLICY IF EXISTS "Users can update their order PDFs" ON storage.objects;
CREATE POLICY "Users can update their order PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'order-attachments' 
  AND public.user_can_modify_order(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'order-attachments' 
  AND public.user_can_modify_order(((storage.foldername(name))[1])::uuid)
);