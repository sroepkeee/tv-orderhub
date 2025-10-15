-- Permitir que todos os usuários autenticados possam visualizar anexos de pedidos
CREATE POLICY "Authenticated users can view order attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'order-attachments');