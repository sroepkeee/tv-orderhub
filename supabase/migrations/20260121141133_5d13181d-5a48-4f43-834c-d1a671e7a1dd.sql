-- Atualizar função get_phase_from_status para incluir a fase de Compras
CREATE OR REPLACE FUNCTION public.get_phase_from_status(_status text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN CASE
    -- Fase: Almox SSM
    WHEN _status IN ('almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved') 
      THEN 'almox_ssm'
    
    -- Fase: Gerar Ordem
    WHEN _status IN ('order_generation_pending', 'order_in_creation', 'order_generated') 
      THEN 'order_generation'
    
    -- Fase: Compras (ADICIONADO - era o problema!)
    WHEN _status IN ('purchase_pending', 'purchase_requested', 'purchase_in_progress', 'purchase_completed', 'purchase_quoted', 'purchase_ordered', 'purchase_received') 
      THEN 'purchases'
    
    -- Fase: Almox Geral
    WHEN _status IN ('almox_general_received', 'almox_general_separating', 'almox_general_ready') 
      THEN 'almox_general'
    
    -- Fase: Produção (fallback para production_client quando não há contexto de categoria)
    WHEN _status IN ('separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed') 
      THEN 'production_client'
    
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
      THEN 'ready_to_invoice'
    
    -- Fase: Faturamento (Solicitado)
    WHEN _status IN ('invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent') 
      THEN 'invoicing'
    
    -- Fase: Expedição
    WHEN _status IN ('released_for_shipping', 'in_expedition', 'pickup_scheduled', 'awaiting_pickup') 
      THEN 'logistics'
    
    -- Fase: Em Trânsito (separada de logistics)
    WHEN _status IN ('in_transit', 'collected') 
      THEN 'in_transit'
    
    -- Fase: Conclusão
    WHEN _status IN ('delivered', 'completed', 'cancelled', 'delayed', 'returned', 'pending', 'in_analysis', 'awaiting_approval', 'planned', 'on_hold') 
      THEN 'completion'
    
    ELSE 'completion' -- Fallback para completion
  END;
END;
$function$;

-- Atualizar também get_phase_from_order para garantir consistência
CREATE OR REPLACE FUNCTION public.get_phase_from_order(_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _status text;
  _category text;
BEGIN
  SELECT status, order_category INTO _status, _category
  FROM orders WHERE id = _order_id;
  
  -- Fase: Produção - decide baseado na categoria do pedido
  IF _status IN ('separation_started', 'in_production', 'awaiting_material', 
                 'separation_completed', 'production_completed') THEN
    IF _category = 'vendas' THEN
      RETURN 'production_client';
    ELSE
      RETURN 'production_stock';
    END IF;
  END IF;
  
  -- Fase: Em Trânsito - fase separada e dedicada
  IF _status IN ('in_transit', 'collected') THEN
    RETURN 'in_transit';
  END IF;
  
  -- Demais fases: usar mapeamento padrão da função get_phase_from_status
  RETURN get_phase_from_status(_status);
END;
$function$;