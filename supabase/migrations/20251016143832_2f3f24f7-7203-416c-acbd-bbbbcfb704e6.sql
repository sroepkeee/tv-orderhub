-- Alterar tipo de integer para numeric(10,2) para suportar quantidades decimais (ex: 0.10 CT)
ALTER TABLE order_items 
ALTER COLUMN requested_quantity TYPE numeric(10,2);

-- Alterar tipo de integer para numeric(10,2) em delivered_quantity
ALTER TABLE order_items 
ALTER COLUMN delivered_quantity TYPE numeric(10,2);