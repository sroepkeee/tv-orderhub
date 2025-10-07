-- Adicionar colunas para gerenciamento de laboratório
ALTER TABLE orders 
ADD COLUMN lab_ticket_id TEXT,
ADD COLUMN lab_status TEXT,
ADD COLUMN lab_notes TEXT,
ADD COLUMN lab_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN lab_completed_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para buscar pedidos vinculados a chamados do laboratório
CREATE INDEX idx_orders_lab_ticket ON orders(lab_ticket_id) 
WHERE lab_ticket_id IS NOT NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN orders.lab_ticket_id IS 'ID do chamado no sistema de laboratório (Imply)';
COMMENT ON COLUMN orders.lab_status IS 'Status atual no laboratório';
COMMENT ON COLUMN orders.lab_notes IS 'Observações do laboratório';
COMMENT ON COLUMN orders.lab_requested_at IS 'Data/hora de envio ao laboratório';
COMMENT ON COLUMN orders.lab_completed_at IS 'Data/hora de conclusão no laboratório';