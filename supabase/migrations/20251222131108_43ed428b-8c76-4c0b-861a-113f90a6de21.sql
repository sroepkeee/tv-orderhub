-- 1. Criar tabela de permissões individuais por usuário
CREATE TABLE public.user_phase_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_advance BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, phase_key, organization_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.user_phase_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas RLS
CREATE POLICY "Org admins can manage user phase permissions"
ON public.user_phase_permissions
FOR ALL
USING (
  (organization_id = get_user_organization_id() AND is_org_admin())
  OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (organization_id = get_user_organization_id() AND is_org_admin())
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view their own permissions"
ON public.user_phase_permissions
FOR SELECT
USING (user_id = auth.uid() OR organization_id = get_user_organization_id());

-- 4. Adicionar campo manager_user_id na phase_config
ALTER TABLE public.phase_config 
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES public.profiles(id);

-- 5. Criar função para verificar permissões individuais de usuário
CREATE OR REPLACE FUNCTION public.user_has_phase_permission(
  _user_id UUID,
  _phase_key TEXT,
  _permission TEXT DEFAULT 'can_view'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_permission BOOLEAN := false;
  user_org_id UUID;
BEGIN
  -- Primeiro, verificar se tem role com acesso total
  IF has_role(_user_id, 'admin') OR has_role(_user_id, 'manager') THEN
    RETURN true;
  END IF;

  -- Pegar org do usuário
  user_org_id := get_user_organization_id(_user_id);

  -- Verificar permissões individuais
  EXECUTE format(
    'SELECT COALESCE((
      SELECT %I FROM user_phase_permissions
      WHERE user_id = $1 AND phase_key = $2 AND organization_id = $3
    ), false)',
    _permission
  ) INTO has_permission USING _user_id, _phase_key, user_org_id;

  IF has_permission THEN
    RETURN true;
  END IF;

  -- Verificar permissões de role
  EXECUTE format(
    'SELECT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN phase_permissions pp ON ur.role = pp.role
      WHERE ur.user_id = $1 AND pp.phase_key = $2 AND pp.%I = true
    )',
    _permission
  ) INTO has_permission USING _user_id, _phase_key;

  RETURN has_permission;
END;
$$;

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_phase_permissions_user_id ON public.user_phase_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phase_permissions_phase_key ON public.user_phase_permissions(phase_key);
CREATE INDEX IF NOT EXISTS idx_user_phase_permissions_org_id ON public.user_phase_permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_phase_config_manager ON public.phase_config(manager_user_id);