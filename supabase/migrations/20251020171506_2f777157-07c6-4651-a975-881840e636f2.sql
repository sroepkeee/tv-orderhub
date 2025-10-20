-- 1. Criar ENUM de roles
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'almox_ssm',
  'planejamento',
  'almox_geral',
  'producao',
  'laboratorio',
  'logistica',
  'comercial',
  'faturamento'
);

-- 2. Criar tabela de user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Criar função security definer para verificar role (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
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

-- 5. Criar função para verificar permissão de fase
CREATE OR REPLACE FUNCTION public.can_edit_phase(_user_id UUID, _phase TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin pode tudo
    public.has_role(_user_id, 'admin') OR
    -- Mapear fase para role
    CASE _phase
      WHEN 'almox_ssm' THEN public.has_role(_user_id, 'almox_ssm')
      WHEN 'order_generation' THEN public.has_role(_user_id, 'planejamento')
      WHEN 'almox_general' THEN public.has_role(_user_id, 'almox_geral')
      WHEN 'production' THEN public.has_role(_user_id, 'producao')
      WHEN 'balance_generation' THEN public.has_role(_user_id, 'faturamento')
      WHEN 'laboratory' THEN public.has_role(_user_id, 'laboratorio')
      WHEN 'packaging' THEN public.has_role(_user_id, 'logistica')
      WHEN 'freight_quote' THEN public.has_role(_user_id, 'comercial')
      WHEN 'invoicing' THEN public.has_role(_user_id, 'faturamento')
      WHEN 'logistics' THEN public.has_role(_user_id, 'logistica')
      ELSE FALSE
    END
$$;

-- 6. Políticas RLS
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Criar tabela para configurar fases e responsáveis
CREATE TABLE public.phase_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  responsible_role app_role NOT NULL,
  icon TEXT,
  color TEXT,
  order_index INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.phase_config ENABLE ROW LEVEL SECURITY;

-- Todos podem ver configurações de fases
CREATE POLICY "Anyone can view phase config"
  ON public.phase_config FOR SELECT
  USING (true);

-- Apenas admins podem modificar configurações
CREATE POLICY "Admins can manage phase config"
  ON public.phase_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. Inserir configurações iniciais de fases
INSERT INTO public.phase_config (phase_key, display_name, responsible_role, icon, color, order_index, description) VALUES
  ('almox_ssm', 'Almox SSM', 'almox_ssm', 'PackageSearch', 'blue', 1, 'Recebimento e análise no almoxarifado SSM'),
  ('order_generation', 'Gerar Ordem', 'planejamento', 'FileEdit', 'indigo', 2, 'Criação da ordem de produção no sistema'),
  ('almox_general', 'Almox Geral', 'almox_geral', 'Warehouse', 'violet', 3, 'Separação de materiais no almoxarifado geral'),
  ('production', 'Produção', 'producao', 'PackageCheck', 'purple', 4, 'Processo de fabricação e montagem'),
  ('balance_generation', 'Gerar Saldo', 'faturamento', 'Receipt', 'fuchsia', 5, 'Cálculo e aprovação de saldo'),
  ('laboratory', 'Laboratório', 'laboratorio', 'Microscope', 'pink', 6, 'Testes e validações técnicas'),
  ('packaging', 'Embalagem', 'logistica', 'Boxes', 'orange', 7, 'Conferência de qualidade e embalagem'),
  ('freight_quote', 'Cotação de Frete', 'comercial', 'Calculator', 'amber', 8, 'Cotação e aprovação de frete'),
  ('invoicing', 'Faturamento', 'faturamento', 'FileText', 'emerald', 9, 'Emissão de nota fiscal'),
  ('logistics', 'Expedição', 'logistica', 'Truck', 'cyan', 10, 'Preparação e envio para transporte');