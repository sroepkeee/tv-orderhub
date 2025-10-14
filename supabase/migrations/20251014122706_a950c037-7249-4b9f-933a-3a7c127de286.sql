-- Adicionar coluna de status de recebimento na tabela order_items
ALTER TABLE order_items 
ADD COLUMN received_status TEXT DEFAULT 'pending';

-- Criar tabela para justificativas de conclusão com pendências
CREATE TABLE order_completion_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  pending_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS na nova tabela
ALTER TABLE order_completion_notes ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver notas de conclusão de seus próprios pedidos
CREATE POLICY "Users can view completion notes on their orders"
  ON order_completion_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_completion_notes.order_id 
    AND orders.user_id = auth.uid()
  ));

-- Policy: usuários podem criar notas de conclusão em seus próprios pedidos
CREATE POLICY "Users can create completion notes on their orders"
  ON order_completion_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_completion_notes.order_id 
    AND orders.user_id = auth.uid()
  ) AND auth.uid() = user_id);