-- =====================================================
-- PARTE 1: Limpar RLS Policies Conflitantes
-- =====================================================

-- Remover policies antigas que dão acesso irrestrito
DROP POLICY IF EXISTS "All authenticated users can view all orders" ON orders;
DROP POLICY IF EXISTS "Approved users can view orders" ON orders;
DROP POLICY IF EXISTS "Approved users can update orders" ON orders;
DROP POLICY IF EXISTS "authenticated_users_can_update_all_orders" ON orders;
DROP POLICY IF EXISTS "allow_create_own_and_ecommerce_orders" ON orders;

-- =====================================================
-- Recriar policy de visualização SEM bypass de aprovação
-- =====================================================
DROP POLICY IF EXISTS "Users can view orders in their phases" ON orders;

CREATE POLICY "Users can view orders in their phases"
ON public.orders
FOR SELECT
TO authenticated
USING (
  -- Admin vê tudo
  has_role(auth.uid(), 'admin')
  
  -- OU usuário tem permissão para a fase do pedido
  OR EXISTS (
    SELECT 1 FROM get_user_phases(auth.uid()) up
    WHERE up.phase_key = get_phase_from_status(orders.status)
  )
  
  -- OU é o dono do pedido (para ver seus próprios pedidos em qualquer fase)
  OR auth.uid() = user_id
);

-- =====================================================
-- Manter policies de edição (já estão corretas)
-- =====================================================
COMMENT ON POLICY "Users can update orders in phases they can edit" 
ON orders 
IS 'Permite editar pedidos apenas nas fases onde o usuário tem can_edit=true';

-- =====================================================
-- Manter policy de criação específica
-- =====================================================
COMMENT ON POLICY "Approved users can create orders"
ON orders
IS 'Usuários aprovados podem criar pedidos próprios ou do tipo ecommerce';

-- =====================================================
-- PARTE 5: Adicionar Índices para Performance
-- =====================================================

-- Índices para melhorar performance de queries de auditoria
CREATE INDEX IF NOT EXISTS idx_user_activity_action_table 
ON user_activity_log(user_id, action_type, table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_action_type 
ON user_activity_log(action_type);

CREATE INDEX IF NOT EXISTS idx_user_activity_table_name 
ON user_activity_log(table_name);

-- Índice para melhorar queries de phase permissions
CREATE INDEX IF NOT EXISTS idx_phase_permissions_role_phase
ON phase_permissions(role, phase_key) WHERE can_view = true;

-- Índice para melhorar queries de user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON user_roles(user_id);

-- =====================================================
-- Documentação do Sistema de Permissões
-- =====================================================
COMMENT ON TABLE phase_permissions IS 
'Sistema de permissões granulares por fase. Cada role pode ter can_view, can_edit e can_delete por fase.';

COMMENT ON FUNCTION get_user_phases IS
'Retorna todas as fases que um usuário pode visualizar, baseado em suas roles. Usado para filtrar pedidos no Dashboard.';