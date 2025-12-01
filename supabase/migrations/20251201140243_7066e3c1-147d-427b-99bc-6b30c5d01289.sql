-- Add business_unit column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_unit text;

-- Update existing orders business_area based on executive_name where cost_center is NULL
UPDATE orders SET 
  business_area = CASE
    WHEN executive_name ILIKE '%FILIAL%' THEN 'filial'
    WHEN executive_name ILIKE '%E-COMMERCE%' OR executive_name ILIKE '%ECOMMERCE%' THEN 'ecommerce'
    WHEN executive_name ILIKE '%PROJETO%' AND executive_name NOT ILIKE '%POS%VENDA%' THEN 'projetos'
    WHEN executive_name ILIKE '%SSM%' OR executive_name ILIKE '%CUSTOMER SERVICE%' OR executive_name ILIKE '%POS%VENDA%' THEN 'ssm'
    ELSE 'ssm'
  END
WHERE cost_center IS NULL AND business_area IS NULL;