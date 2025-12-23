-- Criar tabela menu_permissions para permissões dinâmicas de menu
CREATE TABLE public.menu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.menu_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage menu permissions"
ON public.menu_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own menu permissions"
ON public.menu_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_menu_permissions_updated_at
BEFORE UPDATE ON public.menu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida
CREATE INDEX idx_menu_permissions_user_id ON public.menu_permissions(user_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_permissions;