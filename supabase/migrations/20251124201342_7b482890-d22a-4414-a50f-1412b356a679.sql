-- Atualizar display_name da fase invoicing para "Solicitado Faturamento"
UPDATE phase_config 
SET display_name = 'Solicitado Faturamento'
WHERE phase_key = 'invoicing';