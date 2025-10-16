-- Adicionar novo campo item_status unificado
ALTER TABLE order_items 
ADD COLUMN item_status TEXT DEFAULT 'in_stock';

-- Migrar dados existentes de received_status e item_source_type para item_status
UPDATE order_items 
SET item_status = CASE 
  WHEN received_status = 'completed' THEN 'completed'
  WHEN item_source_type = 'production' THEN 'awaiting_production'
  WHEN item_source_type = 'out_of_stock' THEN 'purchase_required'
  ELSE 'in_stock'
END;

-- Adicionar constraint para validar valores
ALTER TABLE order_items
ADD CONSTRAINT check_item_status 
CHECK (item_status IN ('in_stock', 'awaiting_production', 'purchase_required', 'completed'));

-- Criar índice para performance
CREATE INDEX idx_order_items_status ON order_items(item_status);

-- Comentários para documentação
COMMENT ON COLUMN order_items.item_status IS 'Status unificado do item: in_stock (disponível), awaiting_production (aguardando produção), purchase_required (solicitar compra), completed (concluído)';