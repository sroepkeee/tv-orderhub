-- 1. Atualizar política RLS da tabela orders para permitir edição por qualquer usuário autenticado
DROP POLICY IF EXISTS "allow_update_own_and_ecommerce_orders" ON public.orders;

CREATE POLICY "authenticated_users_can_update_all_orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "authenticated_users_can_update_all_orders" ON public.orders 
IS 'Permite que qualquer usuário autenticado edite pedidos. Auditoria via order_changes.';

-- 2. Criar tabela de auditoria completa order_changes
CREATE TABLE public.order_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL DEFAULT 'update' CHECK (change_type IN ('create', 'update', 'delete'))
);

-- Índices para performance
CREATE INDEX idx_order_changes_order_id ON public.order_changes(order_id);
CREATE INDEX idx_order_changes_changed_by ON public.order_changes(changed_by);
CREATE INDEX idx_order_changes_changed_at ON public.order_changes(changed_at DESC);

-- Habilitar RLS
ALTER TABLE public.order_changes ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer usuário autenticado pode ver e inserir no histórico
CREATE POLICY "Anyone can view order changes"
  ON public.order_changes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert order changes"
  ON public.order_changes FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());