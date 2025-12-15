-- Trigger para atualizar automaticamente o last_order_id em customer_contacts
-- quando um novo pedido é criado com customer_name ou customer_document correspondente

CREATE OR REPLACE FUNCTION public.update_customer_last_order()
RETURNS TRIGGER AS $$
DECLARE
  _customer_id uuid;
BEGIN
  -- Buscar customer_contacts pelo customer_name (case insensitive) ou customer_document
  SELECT id INTO _customer_id
  FROM public.customer_contacts
  WHERE 
    (NEW.customer_document IS NOT NULL AND customer_document = NEW.customer_document)
    OR (customer_name ILIKE NEW.customer_name)
  ORDER BY 
    -- Priorizar match por documento
    CASE WHEN customer_document = NEW.customer_document THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;
  
  -- Se encontrou cliente, atualizar last_order_id e incrementar orders_count
  IF _customer_id IS NOT NULL THEN
    UPDATE public.customer_contacts
    SET 
      last_order_id = NEW.id,
      orders_count = COALESCE(orders_count, 0) + 1,
      updated_at = NOW()
    WHERE id = _customer_id;
    
    RAISE NOTICE 'Updated customer_contacts % with last_order_id %', _customer_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger AFTER INSERT em orders
DROP TRIGGER IF EXISTS trg_update_customer_last_order ON public.orders;
CREATE TRIGGER trg_update_customer_last_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_last_order();