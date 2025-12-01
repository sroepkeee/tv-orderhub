-- Add business area tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cost_center text,
ADD COLUMN IF NOT EXISTS account_item text,
ADD COLUMN IF NOT EXISTS business_area text;

COMMENT ON COLUMN orders.cost_center IS 'Centro de Custo extraído do PDF (RATEIO)';
COMMENT ON COLUMN orders.account_item IS 'Item Conta extraído do PDF (RATEIO)';
COMMENT ON COLUMN orders.business_area IS 'Área de negócio derivada: ssm, filial, projetos, ecommerce';

-- Migrate existing orders based on executive_name
UPDATE orders 
SET business_area = CASE
  WHEN executive_name ILIKE '%FILIAL%' THEN 'filial'
  WHEN executive_name ILIKE '%PROJETO%' OR executive_name ILIKE '%INSTALAÇÃO%' OR executive_name ILIKE '%INSTALACAO%' THEN 'projetos'
  WHEN executive_name ILIKE '%E-COMMERCE%' OR executive_name ILIKE '%ECOMMERCE%' OR executive_name ILIKE '%CARRINHO%' THEN 'ecommerce'
  WHEN executive_name ILIKE '%SSM%' OR executive_name ILIKE '%CUSTOMER SERVICE%' OR executive_name ILIKE '%POS-VENDA%' OR executive_name ILIKE '%PÓS-VENDA%' THEN 'ssm'
  ELSE 'ssm'
END
WHERE business_area IS NULL AND executive_name IS NOT NULL;