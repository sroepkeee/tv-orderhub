-- ========================================
-- LIMPEZA E ATRIBUIÇÃO DE ROLES POR DEPARTAMENTO
-- ========================================

-- 1. Manter apenas admins existentes e remover outras roles
-- Admins: Edson, Henrique, Gabriel, Sanderson
DELETE FROM user_roles 
WHERE user_id NOT IN (
  SELECT id FROM profiles WHERE full_name IN (
    'Edson Massaru',
    'Henrique schwengber',
    'Gabriel Vieira', 
    'Sanderson Roepke'
  )
) OR role != 'admin';

-- 2. Limpar TODAS as roles de usuários não-admin para reatribuir
DELETE FROM user_roles WHERE role != 'admin';

-- ========================================
-- DEPARTAMENTO: SSM → admin (acesso total)
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM profiles p
WHERE p.department = 'SSM'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- SSM IMPLY (conta de serviço) → admin
INSERT INTO user_roles (user_id, role)
VALUES ('9f9b0b40-c773-4301-968d-0ecbf3cbce64', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- DEPARTAMENTO: Almoxarifado SSM → almox_ssm
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'almox_ssm'::app_role
FROM profiles p
WHERE p.department = 'Almoxarifado SSM'
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- DEPARTAMENTO: Compras → purchases
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'purchases'::app_role
FROM profiles p
WHERE p.department = 'Compras'
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- DEPARTAMENTO: Expedição → logistics
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'logistics'::app_role
FROM profiles p
WHERE p.department = 'Expedição'
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- DEPARTAMENTO: Produção → production_client + production_stock
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'production_client'::app_role
FROM profiles p
WHERE p.department = 'Produção'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT p.id, 'production_stock'::app_role
FROM profiles p
WHERE p.department = 'Produção'
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- Manter admins existentes (re-inserir se foram deletados)
-- ========================================
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM profiles p
WHERE p.full_name IN (
  'Edson Massaru',
  'Henrique schwengber',
  'Gabriel Vieira',
  'Sanderson Roepke'
)
ON CONFLICT (user_id, role) DO NOTHING;