-- Adicionar campo para número do pedido TOTVS
ALTER TABLE orders ADD COLUMN totvs_order_number TEXT;

-- Criar índice para busca rápida
CREATE INDEX idx_orders_totvs_number ON orders(totvs_order_number);

-- Adicionar comentário
COMMENT ON COLUMN orders.totvs_order_number IS 'Número do pedido no sistema TOTVS';