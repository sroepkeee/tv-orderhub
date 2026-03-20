-- Step 1: Update order_type_config CHECK to include transfer_out/transfer_in
ALTER TABLE order_type_config DROP CONSTRAINT order_type_config_stock_operation_check;
ALTER TABLE order_type_config ADD CONSTRAINT order_type_config_stock_operation_check 
  CHECK (stock_operation = ANY (ARRAY['entry','exit','transfer','transfer_out','transfer_in','temporary_exit','return']));

-- Step 2: Fix the invalid value
UPDATE order_type_config 
SET stock_operation = 'transfer_out' 
WHERE order_type = 'transferencia_filial' AND stock_operation = 'transfer';

-- Step 3: Update trigger to handle transfer_out properly
CREATE OR REPLACE FUNCTION public.log_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  config_record RECORD;
  item_record RECORD;
BEGIN
  IF (NEW.status = 'completed' OR NEW.status = 'delivered') AND 
     (OLD.status IS NULL OR (OLD.status != 'completed' AND OLD.status != 'delivered')) THEN
    
    SELECT * INTO config_record 
    FROM public.order_type_config 
    WHERE order_type = NEW.order_type;

    IF FOUND THEN
      FOR item_record IN 
        SELECT * FROM public.order_items WHERE order_id = NEW.id
      LOOP
        INSERT INTO public.stock_movements (
          order_id,
          order_item_id,
          item_code,
          quantity,
          movement_type,
          warehouse_from,
          warehouse_to,
          notes,
          user_id
        ) VALUES (
          NEW.id,
          item_record.id,
          item_record.item_code,
          item_record.delivered_quantity,
          config_record.stock_operation,
          CASE 
            WHEN config_record.stock_operation IN ('exit', 'transfer_out') THEN item_record.warehouse
            ELSE NULL
          END,
          CASE 
            WHEN config_record.stock_operation IN ('entry', 'transfer_in') THEN item_record.warehouse
            WHEN config_record.stock_operation = 'transfer_out' THEN config_record.default_warehouse
            ELSE NULL
          END,
          'Movimentação automática - ' || config_record.display_name,
          NEW.user_id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;