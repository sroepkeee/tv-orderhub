-- Remover constraint antiga que impedia salvamento de item_status
ALTER TABLE order_item_history 
DROP CONSTRAINT IF EXISTS valid_field;

-- Adicionar nova constraint incluindo item_status
ALTER TABLE order_item_history 
ADD CONSTRAINT valid_field 
CHECK (field_changed IN (
  'received_status', 
  'delivered_quantity', 
  'item_source_type',
  'item_status'
));