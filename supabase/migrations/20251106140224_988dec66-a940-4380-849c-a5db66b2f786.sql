-- =====================================================
-- SISTEMA DE GERENCIAMENTO DE USUÁRIOS E PERMISSÕES
-- =====================================================

-- 1. Atualizar tabela de profiles para incluir status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 2. Criar tabela de status de aprovação de usuários
CREATE TABLE IF NOT EXISTS public.user_approval_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Criar tabela de mapeamento departamento → role padrão
CREATE TABLE IF NOT EXISTS public.department_role_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL UNIQUE,
  default_role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Popular mapeamento inicial
INSERT INTO public.department_role_mapping (department, default_role) VALUES
  ('Almoxarifado SSM', 'almox_ssm'),
  ('Almoxarifado Geral', 'almox_geral'),
  ('Planejamento', 'planejamento'),
  ('Produção', 'producao'),
  ('Laboratório', 'laboratorio'),
  ('Logística', 'logistica'),
  ('Comercial', 'comercial'),
  ('Faturamento', 'faturamento'),
  ('Administração', 'admin')
ON CONFLICT (department) DO NOTHING;

-- 4. Criar tabela de permissões por fase
CREATE TABLE IF NOT EXISTS public.phase_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  phase_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, phase_key)
);

-- Popular permissões padrão (cada role vê todas as fases mas edita apenas a sua)
INSERT INTO public.phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
  -- Admin vê e edita tudo
  ('admin', 'almox_ssm', true, true, true),
  ('admin', 'order_generation', true, true, true),
  ('admin', 'almox_general', true, true, true),
  ('admin', 'production', true, true, true),
  ('admin', 'balance_generation', true, true, true),
  ('admin', 'laboratory', true, true, true),
  ('admin', 'packaging', true, true, true),
  ('admin', 'freight_quote', true, true, true),
  ('admin', 'ready_to_invoice', true, true, true),
  ('admin', 'invoicing', true, true, true),
  ('admin', 'logistics', true, true, true),
  
  -- Almox SSM
  ('almox_ssm', 'almox_ssm', true, true, false),
  ('almox_ssm', 'order_generation', true, false, false),
  ('almox_ssm', 'almox_general', true, false, false),
  
  -- Planejamento
  ('planejamento', 'order_generation', true, true, false),
  ('planejamento', 'almox_ssm', true, false, false),
  ('planejamento', 'almox_general', true, false, false),
  ('planejamento', 'production', true, false, false),
  
  -- Almox Geral
  ('almox_geral', 'almox_general', true, true, false),
  ('almox_geral', 'order_generation', true, false, false),
  ('almox_geral', 'production', true, false, false),
  
  -- Produção
  ('producao', 'production', true, true, false),
  ('producao', 'almox_general', true, false, false),
  ('producao', 'balance_generation', true, false, false),
  
  -- Laboratório
  ('laboratorio', 'laboratory', true, true, false),
  ('laboratorio', 'production', true, false, false),
  ('laboratorio', 'packaging', true, false, false),
  
  -- Logística
  ('logistica', 'packaging', true, true, false),
  ('logistica', 'logistics', true, true, false),
  ('logistica', 'freight_quote', true, false, false),
  
  -- Comercial
  ('comercial', 'freight_quote', true, true, false),
  ('comercial', 'packaging', true, false, false),
  ('comercial', 'ready_to_invoice', true, false, false),
  
  -- Faturamento
  ('faturamento', 'balance_generation', true, true, false),
  ('faturamento', 'ready_to_invoice', true, true, false),
  ('faturamento', 'invoicing', true, true, false),
  ('faturamento', 'production', true, false, false)
ON CONFLICT (role, phase_key) DO NOTHING;

-- 5. Criar tabela de audit log de permissões
CREATE TABLE IF NOT EXISTS public.permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('user_approved', 'user_rejected', 'role_granted', 'role_revoked', 'permission_changed')),
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Função para verificar se usuário está aprovado
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.user_approval_status WHERE user_id = _user_id),
    false
  );
$$;

-- 7. Função para verificar se usuário pode ver fase
CREATE OR REPLACE FUNCTION public.can_view_phase(_user_id UUID, _phase_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.phase_permissions pp ON ur.role = pp.role
    WHERE ur.user_id = _user_id 
      AND pp.phase_key = _phase_key 
      AND pp.can_view = true
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 8. Trigger para auto-atribuir role baseado no departamento ao criar perfil
CREATE OR REPLACE FUNCTION public.auto_assign_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default_role app_role;
BEGIN
  -- Buscar role padrão baseado no departamento
  SELECT default_role INTO _default_role
  FROM public.department_role_mapping
  WHERE department = NEW.department;
  
  -- Se encontrou mapeamento, atribuir role
  IF _default_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _default_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Criar registro de aprovação pendente
  INSERT INTO public.user_approval_status (user_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_role_on_signup();

-- 9. RLS Policies

-- user_approval_status
ALTER TABLE public.user_approval_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own approval status"
ON public.user_approval_status FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all approval statuses"
ON public.user_approval_status FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update approval statuses"
ON public.user_approval_status FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert approval statuses"
ON public.user_approval_status FOR INSERT
TO authenticated
WITH CHECK (true);

-- phase_permissions
ALTER TABLE public.phase_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view phase permissions"
ON public.phase_permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage phase permissions"
ON public.phase_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- permission_audit_log
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
ON public.permission_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create audit log entries"
ON public.permission_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- department_role_mapping
ALTER TABLE public.department_role_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view department mappings"
ON public.department_role_mapping FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage department mappings"
ON public.department_role_mapping FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Atualizar policy de profiles para admins verem todos
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 10. Atualizar policy de orders para verificar aprovação
DROP POLICY IF EXISTS "Approved users can view orders" ON public.orders;
CREATE POLICY "Approved users can view orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved users can create orders" ON public.orders;
CREATE POLICY "Approved users can create orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (public.is_user_approved(auth.uid()) AND (auth.uid() = user_id OR order_type = 'ecommerce'));

DROP POLICY IF EXISTS "Approved users can update orders" ON public.orders;
CREATE POLICY "Approved users can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.is_user_approved(auth.uid()))
WITH CHECK (public.is_user_approved(auth.uid()));