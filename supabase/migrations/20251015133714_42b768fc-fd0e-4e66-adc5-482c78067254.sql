-- ============================================
-- MIGRATION: Permitir que todos os usuários
-- autenticados possam excluir pedidos
-- ============================================

-- 1. Orders
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;
CREATE POLICY "Any authenticated user can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (true);

-- 2. Order Items
DROP POLICY IF EXISTS "Users can delete their own order items" ON public.order_items;
CREATE POLICY "Any authenticated user can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (true);

-- 3. Order Attachments
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.order_attachments;
CREATE POLICY "Any authenticated user can delete attachments"
ON public.order_attachments
FOR DELETE
TO authenticated
USING (true);

-- 4. Order Comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.order_comments;
CREATE POLICY "Any authenticated user can delete comments"
ON public.order_comments
FOR DELETE
TO authenticated
USING (true);

-- 5. Order History (criar nova política)
CREATE POLICY "Any authenticated user can delete order history"
ON public.order_history
FOR DELETE
TO authenticated
USING (true);

-- 6. Order Completion Notes (criar nova política)
CREATE POLICY "Any authenticated user can delete completion notes"
ON public.order_completion_notes
FOR DELETE
TO authenticated
USING (true);

-- 7. Delivery Date Changes (criar nova política)
CREATE POLICY "Any authenticated user can delete delivery date changes"
ON public.delivery_date_changes
FOR DELETE
TO authenticated
USING (true);

-- 8. Storage: Order Attachments Bucket
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Any authenticated user can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'order-attachments');