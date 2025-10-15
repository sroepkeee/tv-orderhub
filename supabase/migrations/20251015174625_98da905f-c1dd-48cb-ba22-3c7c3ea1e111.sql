-- Criar trigger para rastrear mudanças de delivery_date na tabela ORDERS
-- (complementa o trigger existente que monitora order_items)

CREATE OR REPLACE FUNCTION public.track_order_delivery_date_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.delivery_date IS DISTINCT FROM NEW.delivery_date THEN
    -- Verificar se já existe registro manual recente (evitar duplicatas)
    IF NOT EXISTS (
      SELECT 1 FROM delivery_date_changes
      WHERE order_id = NEW.id
        AND old_date = OLD.delivery_date
        AND new_date = NEW.delivery_date
        AND changed_at > NOW() - INTERVAL '10 seconds'
    ) THEN
      INSERT INTO delivery_date_changes (
        order_item_id,
        order_id,
        old_date,
        new_date,
        changed_by,
        change_source
      ) VALUES (
        NULL, -- Mudança do pedido completo
        NEW.id,
        OLD.delivery_date,
        NEW.delivery_date,
        NEW.user_id,
        'trigger_fallback' -- Indica que veio do trigger, não do dialog
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Criar trigger na tabela orders
DROP TRIGGER IF EXISTS track_orders_delivery_date_trigger ON orders;
CREATE TRIGGER track_orders_delivery_date_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_order_delivery_date_changes();