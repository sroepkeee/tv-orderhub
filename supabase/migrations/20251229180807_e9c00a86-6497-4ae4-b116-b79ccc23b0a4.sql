-- Adicionar campo para armazenar múltiplos order_ids em return_requests
ALTER TABLE return_requests 
ADD COLUMN IF NOT EXISTS order_ids UUID[] DEFAULT '{}';