-- Add freight modality (FOB/CIF) field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight_modality text;

-- Add comment for documentation
COMMENT ON COLUMN orders.freight_modality IS 'Modalidade de frete: FOB (Free On Board) ou CIF (Cost, Insurance and Freight)';