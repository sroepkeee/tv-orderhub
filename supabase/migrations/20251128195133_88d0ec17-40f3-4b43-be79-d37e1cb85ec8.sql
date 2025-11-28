-- Tornar order_id nullable em carrier_conversations
ALTER TABLE carrier_conversations 
  ALTER COLUMN order_id DROP NOT NULL;

-- Adicionar coluna contact_type para identificar tipo de contato
ALTER TABLE carrier_conversations 
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'carrier';

-- Atualizar dados existentes para garantir que contact_type esteja definido
UPDATE carrier_conversations 
SET contact_type = 'carrier' 
WHERE contact_type IS NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN carrier_conversations.order_id IS 'Optional order reference - null for general conversations';
COMMENT ON COLUMN carrier_conversations.contact_type IS 'Type of contact: carrier, customer, technician, or supplier';