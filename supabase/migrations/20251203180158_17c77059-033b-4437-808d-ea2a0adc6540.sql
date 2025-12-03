-- Add sender_company column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_company text;

COMMENT ON COLUMN orders.sender_company IS 'Empresa emissora: imply_tech, imply_sp, imply_rental';