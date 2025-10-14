-- Ajustar política de INSERT para permitir criação de pedidos de e-commerce
-- Remover a política restritiva atual
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- Criar nova política que permite:
-- 1. Usuários criar seus próprios pedidos
-- 2. Qualquer usuário autenticado criar pedidos de e-commerce
CREATE POLICY "Users can create orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR order_type = 'ecommerce'
);

-- Ajustar política de UPDATE para permitir edição de pedidos de e-commerce
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;

CREATE POLICY "Users can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id OR order_type = 'ecommerce'
);

-- Garantir que a política de SELECT permite visualizar todos os pedidos (já existe)
-- Essa política já está correta: "All authenticated users can view all orders"

-- Ajustar política de DELETE (opcional - manter restritiva por segurança)
-- Usuários podem deletar apenas seus próprios pedidos, não pedidos de e-commerce
-- A política atual já está adequada para isso
