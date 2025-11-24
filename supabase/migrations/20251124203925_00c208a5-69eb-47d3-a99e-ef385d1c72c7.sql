-- Add production_order_number column to order_items table
ALTER TABLE order_items 
ADD COLUMN production_order_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN order_items.production_order_number 
IS 'Número da Ordem de Produção associada ao item (PCP)';
