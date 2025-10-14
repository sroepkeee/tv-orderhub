-- Adicionar colunas para rastreamento de origem dos itens
ALTER TABLE order_items 
ADD COLUMN item_source_type TEXT DEFAULT 'in_stock' 
CHECK (item_source_type IN ('in_stock', 'production', 'out_of_stock'));

ALTER TABLE order_items 
ADD COLUMN production_estimated_date DATE NULL;

-- Comentários para documentação
COMMENT ON COLUMN order_items.item_source_type IS 'Origem do item: in_stock (disponível), production (precisa produzir), out_of_stock (sem controle/fora de estoque)';
COMMENT ON COLUMN order_items.production_estimated_date IS 'Data prevista de conclusão da produção (apenas para itens com source_type=production)';