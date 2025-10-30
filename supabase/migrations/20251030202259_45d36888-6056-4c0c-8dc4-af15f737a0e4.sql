-- Adicionar campos de controle de compra na tabela order_items
ALTER TABLE order_items 
  ADD COLUMN purchase_action_started boolean DEFAULT false,
  ADD COLUMN purchase_action_started_at timestamp with time zone,
  ADD COLUMN purchase_action_started_by uuid;

-- Criar índice para otimizar consultas
CREATE INDEX idx_order_items_purchase_action ON order_items(purchase_action_started);

-- Adicionar comentários para documentação
COMMENT ON COLUMN order_items.purchase_action_started IS 'Indica se o processo de compra foi iniciado para este item';
COMMENT ON COLUMN order_items.purchase_action_started_at IS 'Data e hora em que a compra foi marcada como iniciada';
COMMENT ON COLUMN order_items.purchase_action_started_by IS 'ID do usuário que marcou a compra como iniciada';