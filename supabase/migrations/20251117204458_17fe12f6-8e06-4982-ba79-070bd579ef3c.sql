-- PARTE 2: Migrar dados e sincronizar phase_config
-- Agora que os novos valores do enum foram committed, podemos usá-los

-- Migrar dados existentes na tabela user_roles
-- Criar tabela temporária de mapeamento
CREATE TEMP TABLE role_migration_map AS
SELECT 'almox_ssm'::text as old_role, 'almox_ssm'::text as new_role
UNION ALL SELECT 'planejamento', 'order_generation'
UNION ALL SELECT 'almox_geral', 'almox_general'
UNION ALL SELECT 'producao', 'production'
UNION ALL SELECT 'laboratorio', 'laboratory'
UNION ALL SELECT 'logistica', 'logistics'
UNION ALL SELECT 'faturamento', 'invoicing'
UNION ALL SELECT 'comercial', 'freight_quote';

-- Atualizar user_roles com novos valores
UPDATE user_roles ur
SET role = m.new_role::app_role
FROM role_migration_map m
WHERE ur.role::text = m.old_role;

-- Remover roles órfãos que não têm correspondência nas fases
DELETE FROM user_roles WHERE role IN (
  'almox_filial',
  'almox_m16',
  'laboratorio_filial'
);

-- Sincronizar phase_config.responsible_role com phase_key
UPDATE phase_config SET responsible_role = 'almox_ssm'::app_role WHERE phase_key = 'almox_ssm';
UPDATE phase_config SET responsible_role = 'order_generation'::app_role WHERE phase_key = 'order_generation';
UPDATE phase_config SET responsible_role = 'almox_general'::app_role WHERE phase_key = 'almox_general';
UPDATE phase_config SET responsible_role = 'production'::app_role WHERE phase_key = 'production';
UPDATE phase_config SET responsible_role = 'balance_generation'::app_role WHERE phase_key = 'balance_generation';
UPDATE phase_config SET responsible_role = 'laboratory'::app_role WHERE phase_key = 'laboratory';
UPDATE phase_config SET responsible_role = 'packaging'::app_role WHERE phase_key = 'packaging';
UPDATE phase_config SET responsible_role = 'freight_quote'::app_role WHERE phase_key = 'freight_quote';
UPDATE phase_config SET responsible_role = 'invoicing'::app_role WHERE phase_key = 'invoicing';
UPDATE phase_config SET responsible_role = 'logistics'::app_role WHERE phase_key = 'logistics';