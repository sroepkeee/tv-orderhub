-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;

-- Criar nova política de INSERT que permite:
-- 1. Usuários criar seus próprios pedidos
-- 2. Qualquer usuário autenticado criar pedidos de e-commerce
CREATE POLICY "allow_create_own_and_ecommerce_orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR order_type = 'ecommerce'
);

-- Criar nova política de UPDATE que permite:
-- 1. Usuários editar seus próprios pedidos
-- 2. Qualquer usuário autenticado editar pedidos de e-commerce
CREATE POLICY "allow_update_own_and_ecommerce_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id OR order_type = 'ecommerce'
);
