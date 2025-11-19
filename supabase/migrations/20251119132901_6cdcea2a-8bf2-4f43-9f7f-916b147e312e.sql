-- Passo 1: Consolidar permissões em phase_permissions
CREATE TEMP TABLE temp_consolidated_permissions AS
SELECT 
  CASE 
    WHEN role IN ('planejamento') THEN 'order_generation'
    WHEN role IN ('almox_geral', 'almox_filial', 'almox_m16') THEN 'almox_general'
    WHEN role IN ('producao') THEN 'production'
    WHEN role IN ('laboratorio', 'laboratorio_filial') THEN 'laboratory'
    WHEN role IN ('logistica') THEN 'logistics'
    WHEN role IN ('comercial') THEN 'freight_quote'
    WHEN role IN ('faturamento') THEN 'invoicing'
    ELSE role::text
  END as new_role,
  phase_key,
  bool_or(can_view) as can_view,
  bool_or(can_edit) as can_edit,
  bool_or(can_delete) as can_delete
FROM phase_permissions
GROUP BY 
  CASE 
    WHEN role IN ('planejamento') THEN 'order_generation'
    WHEN role IN ('almox_geral', 'almox_filial', 'almox_m16') THEN 'almox_general'
    WHEN role IN ('producao') THEN 'production'
    WHEN role IN ('laboratorio', 'laboratorio_filial') THEN 'laboratory'
    WHEN role IN ('logistica') THEN 'logistics'
    WHEN role IN ('comercial') THEN 'freight_quote'
    WHEN role IN ('faturamento') THEN 'invoicing'
    ELSE role::text
  END,
  phase_key;

DELETE FROM phase_permissions 
WHERE role IN ('planejamento', 'almox_geral', 'almox_filial', 'almox_m16', 
               'producao', 'laboratorio', 'laboratorio_filial', 'logistica', 
               'comercial', 'faturamento');

INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
SELECT new_role::app_role, phase_key, can_view, can_edit, can_delete
FROM temp_consolidated_permissions
ON CONFLICT (role, phase_key) DO UPDATE
SET 
  can_view = EXCLUDED.can_view OR phase_permissions.can_view,
  can_edit = EXCLUDED.can_edit OR phase_permissions.can_edit,
  can_delete = EXCLUDED.can_delete OR phase_permissions.can_delete;

-- Passo 2: Migrar department_role_mapping
UPDATE department_role_mapping SET default_role = 'order_generation' WHERE default_role = 'planejamento';
UPDATE department_role_mapping SET default_role = 'almox_general' WHERE default_role = 'almox_geral';
UPDATE department_role_mapping SET default_role = 'production' WHERE default_role = 'producao';
UPDATE department_role_mapping SET default_role = 'laboratory' WHERE default_role = 'laboratorio';
UPDATE department_role_mapping SET default_role = 'logistics' WHERE default_role = 'logistica';
UPDATE department_role_mapping SET default_role = 'freight_quote' WHERE default_role = 'comercial';
UPDATE department_role_mapping SET default_role = 'invoicing' WHERE default_role = 'faturamento';

-- Passo 3: Recriar enum app_role com CASCADE

-- 3.1. Criar novo enum
CREATE TYPE app_role_new AS ENUM (
  'admin',
  'almox_ssm',
  'order_generation',
  'almox_general',
  'production',
  'balance_generation',
  'laboratory',
  'packaging',
  'freight_quote',
  'invoicing',
  'logistics'
);

-- 3.2. Alterar colunas para usar o novo enum
ALTER TABLE user_roles 
  ALTER COLUMN role TYPE app_role_new USING role::text::app_role_new;

ALTER TABLE phase_permissions
  ALTER COLUMN role TYPE app_role_new USING role::text::app_role_new;

ALTER TABLE department_role_mapping
  ALTER COLUMN default_role TYPE app_role_new USING default_role::text::app_role_new;

ALTER TABLE phase_config
  ALTER COLUMN responsible_role TYPE app_role_new USING responsible_role::text::app_role_new;

-- 3.3. Dropar enum antigo com CASCADE e renomear novo
DROP TYPE app_role CASCADE;
ALTER TYPE app_role_new RENAME TO app_role;

-- 3.4. Recriar função has_role (foi dropada pelo CASCADE)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3.5. Recriar políticas RLS que foram dropadas pelo CASCADE

-- user_roles policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
CREATE POLICY "Admins can manage all roles"
ON user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- phase_config policies
DROP POLICY IF EXISTS "Admins can manage phase config" ON phase_config;
CREATE POLICY "Admins can manage phase config"
ON phase_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- user_approval_status policies
DROP POLICY IF EXISTS "Admins can view all approval statuses" ON user_approval_status;
CREATE POLICY "Admins can view all approval statuses"
ON user_approval_status
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update approval statuses" ON user_approval_status;
CREATE POLICY "Admins can update approval statuses"
ON user_approval_status
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- phase_permissions policies
DROP POLICY IF EXISTS "Admins can manage phase permissions" ON phase_permissions;
CREATE POLICY "Admins can manage phase permissions"
ON phase_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- permission_audit_log policies
DROP POLICY IF EXISTS "Admins can view audit log" ON permission_audit_log;
CREATE POLICY "Admins can view audit log"
ON permission_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create audit log entries" ON permission_audit_log;
CREATE POLICY "Admins can create audit log entries"
ON permission_audit_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- department_role_mapping policies
DROP POLICY IF EXISTS "Admins can manage department mappings" ON department_role_mapping;
CREATE POLICY "Admins can manage department mappings"
ON department_role_mapping
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- purchase_requests policies
DROP POLICY IF EXISTS "Admins and planejamento can update any request" ON purchase_requests;
CREATE POLICY "Admins and planejamento can update any request"
ON purchase_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'order_generation'));

DROP POLICY IF EXISTS "Admins can delete requests" ON purchase_requests;
CREATE POLICY "Admins can delete requests"
ON purchase_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- purchase_request_items policies
DROP POLICY IF EXISTS "Admins and planejamento can manage all items" ON purchase_request_items;
CREATE POLICY "Admins and planejamento can manage all items"
ON purchase_request_items
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'order_generation'));

-- item_purchase_history policies
DROP POLICY IF EXISTS "Admins and planejamento can manage history" ON item_purchase_history;
CREATE POLICY "Admins and planejamento can manage history"
ON item_purchase_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'order_generation'));

-- Passo 4: Atualizar função can_edit_phase
CREATE OR REPLACE FUNCTION public.can_edit_phase(_user_id uuid, _phase text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin') OR
    CASE _phase
      WHEN 'almox_ssm' THEN public.has_role(_user_id, 'almox_ssm')
      WHEN 'order_generation' THEN public.has_role(_user_id, 'order_generation')
      WHEN 'almox_general' THEN public.has_role(_user_id, 'almox_general')
      WHEN 'production' THEN public.has_role(_user_id, 'production')
      WHEN 'balance_generation' THEN public.has_role(_user_id, 'balance_generation')
      WHEN 'laboratory' THEN public.has_role(_user_id, 'laboratory')
      WHEN 'packaging' THEN public.has_role(_user_id, 'packaging')
      WHEN 'freight_quote' THEN public.has_role(_user_id, 'freight_quote')
      WHEN 'invoicing' THEN public.has_role(_user_id, 'invoicing')
      WHEN 'logistics' THEN public.has_role(_user_id, 'logistics')
      ELSE FALSE
    END
$$;