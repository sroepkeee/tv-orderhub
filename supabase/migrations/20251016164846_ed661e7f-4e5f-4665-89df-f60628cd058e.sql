-- Adicionar coluna para armazenar data de emissão do pedido TOTVS
ALTER TABLE orders 
ADD COLUMN issue_date DATE;

-- Comentário para documentação
COMMENT ON COLUMN orders.issue_date IS 'Data de emissão do pedido no sistema TOTVS (extraída do PDF/Excel)';