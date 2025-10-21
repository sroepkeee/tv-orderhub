-- Corrigir políticas RLS para order_history
-- Permitir que todos os usuários autenticados vejam todo o histórico

-- 1. Remover política restritiva de SELECT
DROP POLICY IF EXISTS "Users can view their own order history" ON public.order_history;

-- 2. Criar nova política liberal para visualização
CREATE POLICY "Anyone can view order history"
  ON public.order_history
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Atualizar política de INSERT para ser mais flexível
DROP POLICY IF EXISTS "Users can create their own order history" ON public.order_history;

CREATE POLICY "Authenticated users can create order history"
  ON public.order_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);