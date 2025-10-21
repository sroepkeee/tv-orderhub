-- Permitir que usuários autenticados vejam perfis básicos de outros usuários
-- Necessário para exibir nomes nos históricos de pedidos
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);