-- ==========================================
-- Funções Helper para Gestão de Fases
-- ==========================================

-- Função para obter fases que o usuário pode visualizar
CREATE OR REPLACE FUNCTION public.get_user_phases(_user_id uuid)
RETURNS TABLE(phase_key text, can_edit boolean, order_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT 
    pp.phase_key,
    pp.can_edit,
    pc.order_index
  FROM user_roles ur
  JOIN phase_permissions pp ON ur.role = pp.role
  LEFT JOIN phase_config pc ON pp.phase_key = pc.phase_key
  WHERE ur.user_id = _user_id
    AND pp.can_view = true
  ORDER BY pc.order_index;
$$;

COMMENT ON FUNCTION get_user_phases IS 'Retorna todas as fases que o usuário tem permissão de visualizar com seus respectivos níveis de acesso';

-- Função para mapear status de pedido para phase_key
CREATE OR REPLACE FUNCTION public.get_phase_from_status(_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    -- Fase: Almox SSM
    WHEN _status IN ('almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved') 
      THEN 'almox_ssm'
    
    -- Fase: Gerar Ordem
    WHEN _status IN ('order_generation_pending', 'order_in_creation', 'order_generated') 
      THEN 'order_generation'
    
    -- Fase: Almox Geral
    WHEN _status IN ('almox_general_received', 'almox_general_separating', 'almox_general_ready') 
      THEN 'almox_general'
    
    -- Fase: Produção
    WHEN _status IN ('separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed') 
      THEN 'production'
    
    -- Fase: Gerar Saldo
    WHEN _status IN ('balance_calculation', 'balance_review', 'balance_approved') 
      THEN 'balance_generation'
    
    -- Fase: Laboratório
    WHEN _status IN ('awaiting_lab', 'in_lab_analysis', 'lab_completed') 
      THEN 'laboratory'
    
    -- Fase: Embalagem
    WHEN _status IN ('in_quality_check', 'in_packaging', 'ready_for_shipping') 
      THEN 'packaging'
    
    -- Fase: Cotação de Frete
    WHEN _status IN ('freight_quote_requested', 'freight_quote_received', 'freight_approved') 
      THEN 'freight_quote'
    
    -- Fase: À Faturar
    WHEN _status IN ('ready_to_invoice', 'pending_invoice_request') 
      THEN 'invoicing'
    
    -- Fase: Faturamento (Solicitado)
    WHEN _status IN ('invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent') 
      THEN 'invoicing'
    
    -- Fase: Expedição
    WHEN _status IN ('released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup', 'in_transit', 'collected') 
      THEN 'logistics'
    
    -- Fase: Conclusão
    WHEN _status IN ('delivered', 'completed', 'cancelled', 'delayed', 'returned', 'pending', 'in_analysis', 'awaiting_approval', 'planned', 'on_hold') 
      THEN 'logistics' -- Tratando como logistics por simplicidade
    
    ELSE 'logistics' -- Fallback
  END;
END;
$$;

COMMENT ON FUNCTION get_phase_from_status IS 'Mapeia status do pedido para a fase (phase_key) correspondente';

-- ==========================================
-- RLS Policies para Orders (Baseadas em Fases)
-- ==========================================

-- NOTA: Vamos criar policies adicionais, as existentes continuam funcionando
-- para garantir compatibilidade

-- Usuários podem visualizar pedidos das fases que têm permissão
CREATE POLICY "Users can view orders in their phases"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM get_user_phases(auth.uid()) up
    WHERE up.phase_key = get_phase_from_status(orders.status)
  )
  OR has_role(auth.uid(), 'admin')
  OR is_user_approved(auth.uid()) -- Manter compatibilidade com policy existente
);

-- Usuários podem atualizar pedidos apenas nas fases onde têm permissão de edição
CREATE POLICY "Users can update orders in phases they can edit"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM get_user_phases(auth.uid()) up
    WHERE up.phase_key = get_phase_from_status(orders.status)
      AND up.can_edit = true
  )
  OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM get_user_phases(auth.uid()) up
    WHERE up.phase_key = get_phase_from_status(orders.status)
      AND up.can_edit = true
  )
  OR has_role(auth.uid(), 'admin')
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_status_phase ON orders (status);

COMMENT ON POLICY "Users can view orders in their phases" ON orders IS 'Usuários visualizam pedidos apenas nas fases onde têm permissão';
COMMENT ON POLICY "Users can update orders in phases they can edit" ON orders IS 'Usuários só editam pedidos nas fases onde têm can_edit=true';