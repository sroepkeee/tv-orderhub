-- Adicionar coluna de tipo de embalagem à tabela order_volumes
ALTER TABLE public.order_volumes
ADD COLUMN packaging_type text DEFAULT 'caixa_papelao';

-- Adicionar comentário descritivo
COMMENT ON COLUMN public.order_volumes.packaging_type IS 'Tipo de embalagem: caixa_madeira, caixa_papelao, plastico_bolha, pallet, engradado, sacaria, tambor, outros';