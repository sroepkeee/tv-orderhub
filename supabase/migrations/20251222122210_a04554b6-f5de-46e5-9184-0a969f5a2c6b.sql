-- Remover política que permite acesso público
DROP POLICY IF EXISTS "Anyone can view phase config" ON public.phase_config;

-- A política "Org users can view phase config" já existe e é restritiva
-- Ela permite ver apenas registros da própria organização ou registros globais (organization_id IS NULL)