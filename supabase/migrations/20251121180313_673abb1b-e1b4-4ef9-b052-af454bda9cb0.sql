-- Corrigir a função get_phase_from_status para mapear status de conclusão corretamente
CREATE OR REPLACE FUNCTION public.get_phase_from_status(_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
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
    
    -- Fase: Conclusão (CORRIGIDO - agora inclui delivered, completed, cancelled)
    WHEN _status IN ('delivered', 'completed', 'cancelled', 'delayed', 'returned', 'pending', 'in_analysis', 'awaiting_approval', 'planned', 'on_hold') 
      THEN 'completion'
    
    ELSE 'completion' -- Fallback para completion
  END;
END;
$function$;

-- Adicionar o role completion ao usuário SSM (almoxssm@imply.com)
INSERT INTO user_roles (user_id, role)
SELECT id, 'completion'::app_role
FROM profiles
WHERE email = 'almoxssm@imply.com'
ON CONFLICT (user_id, role) DO NOTHING;