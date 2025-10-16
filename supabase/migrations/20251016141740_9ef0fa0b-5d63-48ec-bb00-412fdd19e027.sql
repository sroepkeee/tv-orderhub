-- Remover a política RLS restritiva
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON order_attachments;

-- Criar política mais permissiva que permite qualquer usuário autenticado
CREATE POLICY "Any authenticated user can upload attachments" 
ON order_attachments 
FOR INSERT 
TO authenticated 
WITH CHECK (true);