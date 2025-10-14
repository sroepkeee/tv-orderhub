-- Criar tabela para rastrear mudanças de prazo de entrega
CREATE TABLE delivery_date_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_date DATE NOT NULL,
  new_date DATE NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_source TEXT DEFAULT 'manual'
);

-- Índices para performance
CREATE INDEX idx_delivery_changes_order ON delivery_date_changes(order_id);
CREATE INDEX idx_delivery_changes_date ON delivery_date_changes(changed_at);
CREATE INDEX idx_delivery_changes_item ON delivery_date_changes(order_item_id);

-- Habilitar RLS
ALTER TABLE delivery_date_changes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view delivery date changes"
  ON delivery_date_changes FOR SELECT
  USING (true);

CREATE POLICY "Users can create delivery date changes"
  ON delivery_date_changes FOR INSERT
  WITH CHECK (auth.uid() = changed_by);

-- Função para rastrear mudanças de data de entrega
CREATE OR REPLACE FUNCTION track_delivery_date_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.delivery_date IS DISTINCT FROM NEW.delivery_date THEN
    INSERT INTO delivery_date_changes (
      order_item_id,
      order_id,
      old_date,
      new_date,
      changed_by,
      change_source
    ) VALUES (
      NEW.id,
      NEW.order_id,
      OLD.delivery_date,
      NEW.delivery_date,
      NEW.user_id,
      'manual'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para rastrear mudanças automaticamente
CREATE TRIGGER track_item_delivery_date_changes
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION track_delivery_date_changes();