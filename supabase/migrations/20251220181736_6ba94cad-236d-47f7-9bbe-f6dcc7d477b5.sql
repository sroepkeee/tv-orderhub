-- =====================================================
-- MULTI-TENANCY FASE 1: Estrutura Base
-- =====================================================

-- 1.1 Criar tabela de organizações (tenants)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL amigável: empresa.vivo.app
  plan TEXT NOT NULL DEFAULT 'starter', -- starter, pro, enterprise
  plan_limits JSONB DEFAULT '{"processes_per_month": 100, "users": 5, "phases": 10, "whatsapp_instances": 1}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{"timezone": "America/Sao_Paulo", "language": "pt-BR"}'::jsonb,
  logo_url TEXT,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Criar tabela de membership (usuário <-> organização)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(organization_id, user_id)
);

-- 1.3 Índices para performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- 1.4 Trigger para updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.5 Habilitar RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 1.6 Função helper: pegar organization_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- 1.7 Função helper: verificar se usuário pertence a uma org
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_org_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id 
      AND organization_id = _org_id
      AND is_active = true
  );
$$;

-- 1.8 Função helper: verificar role na org
CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM organization_members 
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- 1.9 Função helper: verificar se é owner ou admin da org
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id 
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

-- 1.10 RLS Policies para organizations
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (user_belongs_to_org(id));

CREATE POLICY "Org owners/admins can update their organization"
  ON organizations FOR UPDATE
  USING (user_belongs_to_org(id) AND is_org_admin())
  WITH CHECK (user_belongs_to_org(id) AND is_org_admin());

-- Permitir criação de org durante onboarding (antes de ter membership)
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 1.11 RLS Policies para organization_members
CREATE POLICY "Members can view their organization members"
  ON organization_members FOR SELECT
  USING (user_belongs_to_org(organization_id));

CREATE POLICY "Org owners/admins can manage members"
  ON organization_members FOR INSERT
  WITH CHECK (
    -- Permitir criar próprio membership durante onboarding
    (user_id = auth.uid())
    OR 
    -- Ou se for admin da org
    (user_belongs_to_org(organization_id) AND is_org_admin())
  );

CREATE POLICY "Org owners/admins can update members"
  ON organization_members FOR UPDATE
  USING (user_belongs_to_org(organization_id) AND is_org_admin())
  WITH CHECK (user_belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY "Org owners can delete members"
  ON organization_members FOR DELETE
  USING (
    user_belongs_to_org(organization_id) 
    AND get_user_org_role() = 'owner'
    AND user_id != auth.uid() -- Não pode se remover
  );

-- 1.12 Função para criar organização com defaults
CREATE OR REPLACE FUNCTION public.create_organization_with_defaults(
  _org_name TEXT,
  _slug TEXT,
  _owner_user_id UUID,
  _plan TEXT DEFAULT 'starter'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
BEGIN
  -- Criar organização
  INSERT INTO organizations (name, slug, plan)
  VALUES (_org_name, _slug, _plan)
  RETURNING id INTO _org_id;
  
  -- Vincular owner como primeiro membro
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (_org_id, _owner_user_id, 'owner');
  
  -- Atualizar profile do owner com organization_id (será adicionado na próxima migração)
  -- UPDATE profiles SET organization_id = _org_id WHERE id = _owner_user_id;
  
  RETURN _org_id;
END;
$$;