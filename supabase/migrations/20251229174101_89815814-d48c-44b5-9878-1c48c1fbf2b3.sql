-- Tabela de convites de técnicos
CREATE TABLE technician_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  customer_name TEXT NOT NULL,
  customer_document TEXT,
  email TEXT NOT NULL,
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id),
  registered_at TIMESTAMPTZ,
  registered_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE technician_invites ENABLE ROW LEVEL SECURITY;

-- Políticas RLS usando is_org_admin que já existe
CREATE POLICY "Admins podem ver convites da organização"
ON technician_invites FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_admin()
);

CREATE POLICY "Admins podem criar convites"
ON technician_invites FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_org_admin()
);

CREATE POLICY "Admins podem atualizar convites"
ON technician_invites FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_admin()
);

-- Adicionar campo para teste como técnico no perfil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS test_as_customer_document TEXT;