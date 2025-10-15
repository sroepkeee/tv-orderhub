-- Criar tabela para histórico de mudanças em itens individuais
CREATE TABLE IF NOT EXISTS order_item_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Campos que mudaram
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  
  -- Contexto adicional
  notes TEXT,
  
  CONSTRAINT valid_field CHECK (field_changed IN ('received_status', 'delivered_quantity', 'item_source_type'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_item_history_order_item ON order_item_history(order_item_id);
CREATE INDEX IF NOT EXISTS idx_item_history_order ON order_item_history(order_id);
CREATE INDEX IF NOT EXISTS idx_item_history_date ON order_item_history(changed_at DESC);

-- Habilitar RLS
ALTER TABLE order_item_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view item history"
  ON order_item_history FOR SELECT
  USING (true);

CREATE POLICY "Users can create item history"
  ON order_item_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentários para documentação
COMMENT ON TABLE order_item_history IS 'Histórico de mudanças em itens individuais de pedidos';
COMMENT ON COLUMN order_item_history.field_changed IS 'Campo que foi alterado: received_status, delivered_quantity, ou item_source_type';
COMMENT ON COLUMN order_item_history.old_value IS 'Valor anterior do campo';
COMMENT ON COLUMN order_item_history.new_value IS 'Novo valor do campo';