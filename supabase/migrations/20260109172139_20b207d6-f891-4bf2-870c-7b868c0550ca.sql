-- Adicionar coluna filter_purchase_items na tabela ai_manager_trigger_config
ALTER TABLE ai_manager_trigger_config 
ADD COLUMN IF NOT EXISTS filter_purchase_items BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_manager_trigger_config.filter_purchase_items 
IS 'Se TRUE, lista apenas itens com item_status em [purchase_required, purchase_requested, out_of_stock]';

-- Atualizar gatilho "Aguardando Compra" para usar o filtro de itens de compra
UPDATE ai_manager_trigger_config 
SET filter_purchase_items = true,
    include_item_list = true
WHERE trigger_name = 'Aguardando Compra';