-- Remover roles 'laboratory' e 'freight_quote' do usuário SSM
-- Mantém apenas 'almox_ssm'
DELETE FROM user_roles 
WHERE user_id = '9f9b0b40-c773-4301-968d-0ecbf3cbce64' 
  AND role IN ('laboratory', 'freight_quote');