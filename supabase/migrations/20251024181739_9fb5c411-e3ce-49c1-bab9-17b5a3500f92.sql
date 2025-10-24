-- Remover todas as respostas de cotações
DELETE FROM public.freight_quote_responses;

-- Remover todas as cotações de frete
DELETE FROM public.freight_quotes;

-- Remover todas as conversas com transportadoras
DELETE FROM public.carrier_conversations;

-- Remover todas as transportadoras
DELETE FROM public.carriers;