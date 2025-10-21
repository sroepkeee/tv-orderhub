-- Storage policies for bucket `order-attachments`
-- Recreate with DROP IF EXISTS to ensure idempotency

DROP POLICY IF EXISTS "upload_to_order_attachments" ON storage.objects;
DROP POLICY IF EXISTS "update_order_attachments" ON storage.objects;
DROP POLICY IF EXISTS "delete_from_order_attachments" ON storage.objects;
DROP POLICY IF EXISTS "read_order_attachments" ON storage.objects;

CREATE POLICY "upload_to_order_attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "update_order_attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'order-attachments')
WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "delete_from_order_attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'order-attachments');

CREATE POLICY "read_order_attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'order-attachments');