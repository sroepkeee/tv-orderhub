-- Tabela de convites para organização
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  whatsapp TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  sent_via_email BOOLEAN DEFAULT false,
  sent_via_whatsapp BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_org_invites_token ON public.organization_invites(invite_token);
CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX idx_org_invites_email ON public.organization_invites(email);
CREATE INDEX idx_org_invites_status ON public.organization_invites(status);

-- RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Políticas: admins da organização podem gerenciar convites
CREATE POLICY "Admins podem ver convites da org"
  ON public.organization_invites FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

CREATE POLICY "Admins podem criar convites"
  ON public.organization_invites FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

CREATE POLICY "Admins podem atualizar convites"
  ON public.organization_invites FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- Permitir leitura pública por token (para validação no signup)
CREATE POLICY "Qualquer um pode validar token"
  ON public.organization_invites FOR SELECT
  USING (invite_token IS NOT NULL);

-- Permitir update de convite por token (para marcar como usado)
CREATE POLICY "Service role pode atualizar qualquer convite"
  ON public.organization_invites FOR UPDATE
  USING (true)
  WITH CHECK (true);