-- Correção 1: Atualizar current_phase dos itens existentes baseado no item_status
UPDATE order_items 
SET current_phase = CASE
    WHEN item_status = 'completed' THEN 'completed'
    WHEN item_status = 'in_production' THEN 'in_production'
    WHEN item_status = 'awaiting_production' THEN 'awaiting_production'
    WHEN item_status = 'in_stock' THEN 'in_stock'
    WHEN item_status = 'purchase_required' THEN 'purchase_required'
    WHEN item_status = 'purchase_requested' THEN 'purchase_requested'
    WHEN item_status = 'delivered' THEN 'delivered'
    ELSE COALESCE(current_phase, 'pending')
END
WHERE current_phase = 'pending' OR current_phase IS NULL;

-- Correção 2: Criar função para sincronizar current_phase automaticamente
CREATE OR REPLACE FUNCTION sync_item_phase_from_status()
RETURNS trigger AS $$
BEGIN
  -- Atualizar current_phase baseado no item_status
  IF NEW.item_status IS DISTINCT FROM OLD.item_status THEN
    NEW.current_phase := CASE
      WHEN NEW.item_status = 'completed' THEN 'completed'
      WHEN NEW.item_status = 'in_production' THEN 'in_production'
      WHEN NEW.item_status = 'awaiting_production' THEN 'awaiting_production'
      WHEN NEW.item_status = 'in_stock' THEN 'in_stock'
      WHEN NEW.item_status = 'purchase_required' THEN 'purchase_required'
      WHEN NEW.item_status = 'purchase_requested' THEN 'purchase_requested'
      WHEN NEW.item_status = 'delivered' THEN 'delivered'
      ELSE COALESCE(NEW.current_phase, 'pending')
    END;
    NEW.phase_started_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Correção 3: Criar trigger para sincronizar automaticamente
DROP TRIGGER IF EXISTS sync_item_phase_trigger ON order_items;
CREATE TRIGGER sync_item_phase_trigger
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_item_phase_from_status();