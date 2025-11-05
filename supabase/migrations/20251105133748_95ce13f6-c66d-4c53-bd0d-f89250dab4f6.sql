-- Configurar REPLICA IDENTITY para capturar mudanças completas
-- Isso garante que todos os campos sejam enviados nos eventos realtime
-- (Nota: tabelas já estão na publicação supabase_realtime)

ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE order_history REPLICA IDENTITY FULL;

-- Criar índice para otimizar queries de realtime em order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON order_items(order_id);