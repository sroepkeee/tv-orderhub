-- ====================================================================
-- CORREÇÃO: Permitir que qualquer usuário autenticado edite order_items
-- ====================================================================
-- Isso permite que todos os usuários possam atualizar:
-- - Quantidade recebida (delivered_quantity)
-- - Data de entrega (delivery_date)  
-- - Status do item (item_status)
-- - Outros campos necessários para acompanhamento
-- ====================================================================

-- 1. Remover política restritiva antiga
DROP POLICY IF EXISTS "Users can update their own order items" ON public.order_items;

-- 2. Criar nova política que permite qualquer usuário autenticado atualizar
CREATE POLICY "Any authenticated user can update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ====================================================================
-- Comentário: Esta mudança permite melhor colaboração entre usuários
-- para atualizar informações críticas como quantidade recebida e 
-- data de entrega, essenciais para o acompanhamento de pedidos.
-- ====================================================================