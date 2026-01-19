-- ============================================
-- MÓDULO COMPLETO DE DEVOLUÇÃO DE TÉCNICOS
-- Fase 1: Estrutura de Banco de Dados
-- ============================================

-- 1. Tabela: return_processes (Processo Mestre de Devolução)
CREATE TABLE public.return_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  technician_id UUID NOT NULL REFERENCES public.technicians(id),
  motivo TEXT NOT NULL CHECK (motivo IN ('desligamento', 'troca', 'ferias', 'transferencia', 'outro')),
  motivo_detalhes TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_checklist', 'aguardando_envio', 'enviado', 'em_transito', 'recebido', 'em_conferencia', 'divergencia', 'finalizado', 'cancelado')),
  opened_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela: checklist_templates (Templates de Checklist por Cargo/Categoria)
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  target_role TEXT, -- cargo do técnico (opcional, para templates específicos)
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela: checklist_template_items (Itens do Template de Checklist)
CREATE TABLE public.checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('itens_fisicos', 'administrativo', 'acessos', 'documentos', 'financeiro')),
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  requires_photo BOOLEAN DEFAULT false,
  requires_video BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabela: process_checklist_items (Itens do Checklist de um Processo)
CREATE TABLE public.process_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.return_processes(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.checklist_template_items(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'nao_aplicavel', 'divergente')),
  condition TEXT CHECK (condition IN ('bom', 'danificado', 'faltante', 'nao_verificado')),
  evidence_urls TEXT[], -- array de URLs das evidências (fotos/vídeos)
  signature_url TEXT, -- URL da assinatura digital
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabela: divergencias (Registro de Divergências)
CREATE TABLE public.divergencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  process_id UUID NOT NULL REFERENCES public.return_processes(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES public.process_checklist_items(id),
  item_name TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('faltante', 'danificado', 'incorreto', 'quantidade_incorreta')),
  description TEXT,
  expected_value TEXT, -- valor/quantidade esperado
  actual_value TEXT, -- valor/quantidade encontrado
  estimated_cost DECIMAL(10,2),
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'identificada' CHECK (status IN ('identificada', 'notificada_gpi', 'em_analise', 'cobranca', 'resolvida', 'desconsiderada')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabela: access_blocks (Controle de Bloqueio de Acessos - TI)
CREATE TABLE public.access_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  process_id UUID NOT NULL REFERENCES public.return_processes(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('email', 'paytrack', 'desk_manager', 'sistema_interno', 'integracao_externa', 'outro')),
  access_name TEXT, -- nome específico do acesso (ex: "email@empresa.com")
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'bloqueado', 'erro', 'nao_aplicavel')),
  blocked_by UUID REFERENCES auth.users(id),
  blocked_at TIMESTAMP WITH TIME ZONE,
  evidence_url TEXT, -- print do bloqueio
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Tabela: return_audit_log (Log de Auditoria Completo)
CREATE TABLE public.return_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  process_id UUID REFERENCES public.return_processes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'process', 'checklist', 'divergence', 'access', 'shipping'
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Tabela: process_shipping (Logística de Envio)
CREATE TABLE public.process_shipping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  process_id UUID NOT NULL REFERENCES public.return_processes(id) ON DELETE CASCADE,
  carrier_type TEXT CHECK (carrier_type IN ('correios', 'transportadora', 'entrega_pessoal', 'outro')),
  carrier_name TEXT,
  tracking_code TEXT,
  label_url TEXT, -- URL da etiqueta
  origin_address JSONB, -- endereço de origem
  destination_address JSONB, -- endereço de destino
  destination_type TEXT CHECK (destination_type IN ('sede', 'filial', 'tecnico_receptor', 'outro')),
  receiver_technician_id UUID REFERENCES public.technicians(id),
  estimated_delivery DATE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_confirmed_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'etiqueta_gerada', 'postado', 'em_transito', 'entregue', 'confirmado', 'problema')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Tabela: responsibility_terms (Termos de Responsabilidade)
CREATE TABLE public.responsibility_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  technician_id UUID NOT NULL REFERENCES public.technicians(id),
  term_type TEXT NOT NULL CHECK (term_type IN ('equipamento', 'veiculo', 'ferramental', 'epi', 'uniforme', 'outros')),
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_url TEXT,
  items JSONB, -- lista de itens cobertos pelo termo
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado', 'pendente_assinatura')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Adicionar campo motivo à tabela return_requests existente
ALTER TABLE public.return_requests 
ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES public.return_processes(id),
ADD COLUMN IF NOT EXISTS motivo TEXT;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_return_processes_org ON public.return_processes(organization_id);
CREATE INDEX idx_return_processes_technician ON public.return_processes(technician_id);
CREATE INDEX idx_return_processes_status ON public.return_processes(status);
CREATE INDEX idx_process_checklist_process ON public.process_checklist_items(process_id);
CREATE INDEX idx_divergencias_process ON public.divergencias(process_id);
CREATE INDEX idx_divergencias_status ON public.divergencias(status);
CREATE INDEX idx_access_blocks_process ON public.access_blocks(process_id);
CREATE INDEX idx_access_blocks_technician ON public.access_blocks(technician_id);
CREATE INDEX idx_return_audit_process ON public.return_audit_log(process_id);
CREATE INDEX idx_return_audit_user ON public.return_audit_log(user_id);
CREATE INDEX idx_process_shipping_process ON public.process_shipping(process_id);
CREATE INDEX idx_responsibility_terms_technician ON public.responsibility_terms(technician_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.return_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsibility_terms ENABLE ROW LEVEL SECURITY;

-- Policies para return_processes
CREATE POLICY "Users can view return processes from their organization" ON public.return_processes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create return processes in their organization" ON public.return_processes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update return processes from their organization" ON public.return_processes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para checklist_templates
CREATE POLICY "Users can view checklist templates from their organization" ON public.checklist_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ) OR organization_id IS NULL
  );

CREATE POLICY "Users can manage checklist templates in their organization" ON public.checklist_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para checklist_template_items
CREATE POLICY "Users can view template items" ON public.checklist_template_items
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM public.checklist_templates WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      ) OR organization_id IS NULL
    )
  );

CREATE POLICY "Users can manage template items" ON public.checklist_template_items
  FOR ALL USING (
    template_id IN (
      SELECT id FROM public.checklist_templates WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Policies para process_checklist_items
CREATE POLICY "Users can view checklist items from their org processes" ON public.process_checklist_items
  FOR SELECT USING (
    process_id IN (
      SELECT id FROM public.return_processes WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage checklist items from their org processes" ON public.process_checklist_items
  FOR ALL USING (
    process_id IN (
      SELECT id FROM public.return_processes WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Policies para divergencias
CREATE POLICY "Users can view divergencias from their organization" ON public.divergencias
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage divergencias in their organization" ON public.divergencias
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para access_blocks
CREATE POLICY "Users can view access blocks from their organization" ON public.access_blocks
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage access blocks in their organization" ON public.access_blocks
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para return_audit_log
CREATE POLICY "Users can view audit logs from their organization" ON public.return_audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create audit logs in their organization" ON public.return_audit_log
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para process_shipping
CREATE POLICY "Users can view shipping from their organization" ON public.process_shipping
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage shipping in their organization" ON public.process_shipping
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policies para responsibility_terms
CREATE POLICY "Users can view terms from their organization" ON public.responsibility_terms
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage terms in their organization" ON public.responsibility_terms
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE TRIGGER update_return_processes_updated_at
  BEFORE UPDATE ON public.return_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_checklist_items_updated_at
  BEFORE UPDATE ON public.process_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_divergencias_updated_at
  BEFORE UPDATE ON public.divergencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_access_blocks_updated_at
  BEFORE UPDATE ON public.access_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_shipping_updated_at
  BEFORE UPDATE ON public.process_shipping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_responsibility_terms_updated_at
  BEFORE UPDATE ON public.responsibility_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TEMPLATE PADRÃO DE CHECKLIST
-- ============================================

INSERT INTO public.checklist_templates (name, description, is_default, is_active)
VALUES ('Checklist Padrão de Devolução', 'Template padrão para processos de devolução de técnicos', true, true);

-- Inserir itens do template padrão
WITH template AS (SELECT id FROM public.checklist_templates WHERE is_default = true LIMIT 1)
INSERT INTO public.checklist_template_items (template_id, name, category, description, is_required, requires_photo, sort_order)
SELECT 
  template.id,
  item.name,
  item.category,
  item.description,
  item.is_required,
  item.requires_photo,
  item.sort_order
FROM template, (VALUES
  -- Itens Físicos
  ('Celular Corporativo', 'itens_fisicos', 'Aparelho celular + carregador + cabo', true, true, 1),
  ('Chip Corporativo', 'itens_fisicos', 'Chip da operadora', true, true, 2),
  ('Notebook', 'itens_fisicos', 'Notebook + carregador + mouse', true, true, 3),
  ('Ferramental Completo', 'itens_fisicos', 'Maleta de ferramentas', true, true, 4),
  ('Itens Sobressalentes', 'itens_fisicos', 'Peças e materiais em posse', false, true, 5),
  ('Uniformes', 'itens_fisicos', 'Camisas, calças, jaquetas', true, true, 6),
  ('EPIs', 'itens_fisicos', 'Capacete, óculos, luvas, etc', true, true, 7),
  ('Veículo', 'itens_fisicos', 'Se aplicável - documentos + chaves', false, true, 8),
  -- Administrativo
  ('Despesas de Viagem', 'administrativo', 'Prestação de contas pendentes', true, false, 10),
  ('Notas Fiscais', 'administrativo', 'NFs emitidas no nome do técnico', true, false, 11),
  ('Ordens de Serviço', 'administrativo', 'OS pendentes de fechamento', true, false, 12),
  ('Chamados em Execução', 'administrativo', 'Transferir ou finalizar chamados', true, false, 13),
  ('Termos Assinados', 'documentos', 'Verificar termos de responsabilidade', true, false, 14),
  -- Acessos
  ('Email Corporativo', 'acessos', 'Bloquear acesso ao email', true, false, 20),
  ('Desk Manager', 'acessos', 'Bloquear acesso ao sistema de chamados', true, false, 21),
  ('Paytrack', 'acessos', 'Bloquear acesso ao sistema de despesas', true, false, 22),
  ('Sistema Interno', 'acessos', 'Bloquear acesso ao ERP/Sistema', true, false, 23),
  ('Integrações Externas', 'acessos', 'Revogar acessos a sistemas de terceiros', false, false, 24)
) AS item(name, category, description, is_required, requires_photo, sort_order);