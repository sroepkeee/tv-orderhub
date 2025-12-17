-- Add material_type column to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS material_type TEXT;

COMMENT ON COLUMN order_items.material_type IS 'Tipo de material: PA, ME, MP, MC, PI, BN';