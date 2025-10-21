-- Adicionar campos de volume e dimensões na tabela orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS package_volumes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS package_weight_kg NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS package_height_m NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS package_width_m NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS package_length_m NUMERIC(10, 3);

-- Comentários explicativos
COMMENT ON COLUMN public.orders.package_volumes IS 'Número de volumes/pacotes do pedido';
COMMENT ON COLUMN public.orders.package_weight_kg IS 'Peso total em quilogramas';
COMMENT ON COLUMN public.orders.package_height_m IS 'Altura em metros';
COMMENT ON COLUMN public.orders.package_width_m IS 'Largura em metros';
COMMENT ON COLUMN public.orders.package_length_m IS 'Comprimento em metros';

-- Adicionar índice composto para melhor performance nas consultas de histórico
CREATE INDEX IF NOT EXISTS idx_order_changes_order_user_time 
ON public.order_changes(order_id, changed_by, changed_at DESC);

-- Adicionar campo change_category para categorizar mudanças
ALTER TABLE public.order_changes
ADD COLUMN IF NOT EXISTS change_category TEXT DEFAULT 'field_update';

COMMENT ON COLUMN public.order_changes.change_category IS 'Categoria: status_change, field_update, shipping_info, dimensions, etc';