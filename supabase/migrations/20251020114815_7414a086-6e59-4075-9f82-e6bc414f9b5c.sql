-- Atualizar SLAs para Operações Especiais (7 dias úteis)
UPDATE public.order_type_config 
SET default_sla_days = 7
WHERE category = 'operacoes_especiais';

-- Atualizar SLAs para Reposição (7 dias úteis)
UPDATE public.order_type_config 
SET default_sla_days = 7
WHERE category = 'reposicao';

-- Atualizar SLAs para Vendas (2 dias úteis)
UPDATE public.order_type_config 
SET default_sla_days = 2
WHERE category = 'vendas';