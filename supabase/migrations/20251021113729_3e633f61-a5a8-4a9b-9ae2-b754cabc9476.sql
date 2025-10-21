-- Remover políticas restritivas atuais de order_comments
DROP POLICY IF EXISTS "Users can create comments on their own orders" ON public.order_comments;
DROP POLICY IF EXISTS "Users can view comments on their own orders" ON public.order_comments;

-- Permitir que qualquer usuário autenticado possa comentar em qualquer pedido
CREATE POLICY "Any authenticated user can create comments"
  ON public.order_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Permitir que qualquer usuário autenticado possa ver todos os comentários
CREATE POLICY "Any authenticated user can view comments"
  ON public.order_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Atualizar a política de update (já existente, mas garantir que está correta)
DROP POLICY IF EXISTS "Users can update their own comments" ON public.order_comments;
CREATE POLICY "Users can update their own comments"
  ON public.order_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atualizar a política de delete (já existente, mas garantir que permite apenas dono)
DROP POLICY IF EXISTS "Any authenticated user can delete comments" ON public.order_comments;
CREATE POLICY "Users can delete their own comments"
  ON public.order_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Verificar e tornar o bucket order-attachments público (para preview de imagens)
UPDATE storage.buckets SET public = true WHERE id = 'order-attachments';