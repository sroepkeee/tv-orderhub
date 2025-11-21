-- Adicionar coluna de empresa na tabela purchase_requests
ALTER TABLE purchase_requests 
ADD COLUMN company text;

-- Adicionar constraint para valores válidos de empresa
ALTER TABLE purchase_requests
ADD CONSTRAINT valid_company CHECK (company IN ('IMPLY TEC', 'IMPLY RENTAL', 'IMPLY FILIAL'));

-- Adicionar coluna de projeto na tabela item_cost_allocation
ALTER TABLE item_cost_allocation
ADD COLUMN project text;