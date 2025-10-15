-- Tornar order_item_id nullable para permitir mudanças no pedido inteiro
ALTER TABLE delivery_date_changes 
ALTER COLUMN order_item_id DROP NOT NULL;

-- Adicionar constraint de validação: pelo menos um dos dois deve estar preenchido
ALTER TABLE delivery_date_changes 
ADD CONSTRAINT check_order_or_item 
CHECK (
  (order_id IS NOT NULL AND order_item_id IS NULL) OR  -- Mudança do pedido
  (order_item_id IS NOT NULL)                          -- Mudança de item
);

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_delivery_date_changes_order_item 
ON delivery_date_changes(order_item_id) 
WHERE order_item_id IS NOT NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN delivery_date_changes.order_item_id IS 'ID do item (NULL quando a mudança é do pedido inteiro)';
COMMENT ON CONSTRAINT check_order_or_item ON delivery_date_changes IS 'Garante que mudanças são vinculadas ao pedido OU a um item específico';