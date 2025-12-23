-- =====================================================
-- CUSTOMER CHANGE REQUESTS
-- Sistema de solicitações de alteração via WhatsApp
-- =====================================================

-- Criar tipo enum para tipos de alteração
CREATE TYPE public.change_request_type AS ENUM (
  'delivery_address',    -- Alterar endereço
  'delivery_date',       -- Alterar data
  'add_item',            -- Adicionar item
  'remove_item',         -- Remover item
  'change_quantity',     -- Alterar quantidade
  'cancel_order',        -- Cancelar pedido
  'change_contact',      -- Alterar contato
  'other'                -- Outro
);

-- Criar tipo enum para status da solicitação
CREATE TYPE public.change_request_status AS ENUM (
  'pending',    -- Aguardando aprovação
  'approved',   -- Aprovado
  'rejected',   -- Rejeitado
  'applied'     -- Aplicado no pedido
);

-- Tabela de solicitações de alteração de clientes
CREATE TABLE public.customer_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  customer_contact_id UUID REFERENCES public.customer_contacts(id),
  organization_id UUID REFERENCES public.organizations(id),
  
  -- Quem solicitou (número do WhatsApp)
  requested_by_phone TEXT NOT NULL,
  requested_by_name TEXT,
  
  -- Tipo da alteração
  change_type public.change_request_type NOT NULL,
  
  -- Detalhes da solicitação
  description TEXT NOT NULL,
  original_value TEXT,     -- Valor anterior
  requested_value TEXT,    -- Valor solicitado
  
  -- Fluxo de aprovação
  status public.change_request_status DEFAULT 'pending',
  
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Rastreabilidade
  conversation_id UUID REFERENCES public.carrier_conversations(id),
  message_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_change_requests_order_id ON public.customer_change_requests(order_id);
CREATE INDEX idx_change_requests_status ON public.customer_change_requests(status);
CREATE INDEX idx_change_requests_customer ON public.customer_change_requests(customer_contact_id);
CREATE INDEX idx_change_requests_phone ON public.customer_change_requests(requested_by_phone);
CREATE INDEX idx_change_requests_created_at ON public.customer_change_requests(created_at DESC);
CREATE INDEX idx_change_requests_org ON public.customer_change_requests(organization_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_customer_change_requests_updated_at
  BEFORE UPDATE ON public.customer_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Admins e gestores podem ver todas as solicitações da organização
CREATE POLICY "Org users can view change requests"
  ON public.customer_change_requests
  FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Apenas admins podem aprovar/rejeitar
CREATE POLICY "Org admins can update change requests"
  ON public.customer_change_requests
  FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_admin());

-- Sistema pode inserir (via edge functions)
CREATE POLICY "System can insert change requests"
  ON public.customer_change_requests
  FOR INSERT
  WITH CHECK (true);

-- Admins podem deletar
CREATE POLICY "Org admins can delete change requests"
  ON public.customer_change_requests
  FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin());