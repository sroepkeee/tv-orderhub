-- Adicionar coluna NCM na tabela order_items
ALTER TABLE public.order_items 
ADD COLUMN ncm_code TEXT DEFAULT NULL;

-- Comentário descritivo
COMMENT ON COLUMN public.order_items.ncm_code IS 'Código NCM (Nomenclatura Comum do Mercosul) do item';