-- Adicionar campos logísticos na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight_value DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_document TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS operation_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS executive_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS municipality TEXT;

-- Adicionar campos de valores nos itens
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_value DECIMAL(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ipi_percent DECIMAL(5,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS icms_percent DECIMAL(5,2);

-- Índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_orders_totvs ON orders(totvs_order_number);
CREATE INDEX IF NOT EXISTS idx_orders_shipping ON orders(shipping_date);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier_name);