-- =============================================
-- SISTEMA DE CONTROLE DE REMESSAS PARA TÉCNICOS
-- Logística Reversa de Consertos e Garantias
-- =============================================

-- Tabela de Técnicos
CREATE TABLE public.technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  document TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  zip_code TEXT,
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Envios para Técnicos
CREATE TABLE public.technician_dispatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) NOT NULL,
  origin_warehouse TEXT NOT NULL,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  status TEXT NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'partial_return', 'fully_returned', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Itens Enviados
CREATE TABLE public.technician_dispatch_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_id UUID REFERENCES public.technician_dispatches(id) ON DELETE CASCADE NOT NULL,
  order_item_id UUID REFERENCES public.order_items(id),
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'UN',
  quantity_sent NUMERIC NOT NULL DEFAULT 1,
  quantity_returned NUMERIC NOT NULL DEFAULT 0,
  return_status TEXT NOT NULL DEFAULT 'pending' CHECK (return_status IN ('pending', 'partial', 'returned', 'lost', 'consumed')),
  returned_at TIMESTAMP WITH TIME ZONE,
  returned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Solicitações de Retorno
CREATE TABLE public.return_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  dispatch_id UUID REFERENCES public.technician_dispatches(id) NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) NOT NULL,
  destination_warehouse TEXT NOT NULL,
  pickup_address TEXT,
  pickup_city TEXT,
  pickup_state TEXT,
  pickup_zip_code TEXT,
  pickup_contact TEXT,
  pickup_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'in_transit', 'received', 'rejected', 'cancelled')),
  carrier_id UUID REFERENCES public.carriers(id),
  tracking_code TEXT,
  freight_value NUMERIC,
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  scheduled_pickup_date DATE,
  received_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Itens do Retorno
CREATE TABLE public.return_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_request_id UUID REFERENCES public.return_requests(id) ON DELETE CASCADE NOT NULL,
  dispatch_item_id UUID REFERENCES public.technician_dispatch_items(id) NOT NULL,
  quantity_returning NUMERIC NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'for_repair', 'for_disposal')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_technicians_org ON public.technicians(organization_id);
CREATE INDEX idx_technicians_user ON public.technicians(user_id);
CREATE INDEX idx_technician_dispatches_org ON public.technician_dispatches(organization_id);
CREATE INDEX idx_technician_dispatches_order ON public.technician_dispatches(order_id);
CREATE INDEX idx_technician_dispatches_technician ON public.technician_dispatches(technician_id);
CREATE INDEX idx_technician_dispatches_status ON public.technician_dispatches(status);
CREATE INDEX idx_technician_dispatch_items_dispatch ON public.technician_dispatch_items(dispatch_id);
CREATE INDEX idx_return_requests_org ON public.return_requests(organization_id);
CREATE INDEX idx_return_requests_dispatch ON public.return_requests(dispatch_id);
CREATE INDEX idx_return_requests_technician ON public.return_requests(technician_id);
CREATE INDEX idx_return_requests_status ON public.return_requests(status);
CREATE INDEX idx_return_request_items_request ON public.return_request_items(return_request_id);

-- Enable RLS
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_request_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for technicians
CREATE POLICY "Org users can view technicians"
  ON public.technicians FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create technicians"
  ON public.technicians FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org users can update technicians"
  ON public.technicians FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete technicians"
  ON public.technicians FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin());

-- Technician can view own data
CREATE POLICY "Technicians can view own data"
  ON public.technicians FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for technician_dispatches
CREATE POLICY "Org users can view dispatches"
  ON public.technician_dispatches FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create dispatches"
  ON public.technician_dispatches FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update dispatches"
  ON public.technician_dispatches FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete dispatches"
  ON public.technician_dispatches FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin());

-- Technician can view own dispatches
CREATE POLICY "Technicians can view own dispatches"
  ON public.technician_dispatches FOR SELECT
  USING (technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid()));

-- RLS Policies for technician_dispatch_items
CREATE POLICY "Org users can view dispatch items"
  ON public.technician_dispatch_items FOR SELECT
  USING (dispatch_id IN (SELECT id FROM public.technician_dispatches WHERE organization_id = get_user_organization_id()));

CREATE POLICY "Org users can create dispatch items"
  ON public.technician_dispatch_items FOR INSERT
  WITH CHECK (dispatch_id IN (SELECT id FROM public.technician_dispatches WHERE organization_id = get_user_organization_id() OR organization_id IS NULL));

CREATE POLICY "Org users can update dispatch items"
  ON public.technician_dispatch_items FOR UPDATE
  USING (dispatch_id IN (SELECT id FROM public.technician_dispatches WHERE organization_id = get_user_organization_id()));

CREATE POLICY "Org admins can delete dispatch items"
  ON public.technician_dispatch_items FOR DELETE
  USING (dispatch_id IN (SELECT id FROM public.technician_dispatches WHERE organization_id = get_user_organization_id()) AND is_org_admin());

-- Technician can view own dispatch items
CREATE POLICY "Technicians can view own dispatch items"
  ON public.technician_dispatch_items FOR SELECT
  USING (dispatch_id IN (
    SELECT td.id FROM public.technician_dispatches td
    JOIN public.technicians t ON td.technician_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- RLS Policies for return_requests
CREATE POLICY "Org users can view return requests"
  ON public.return_requests FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create return requests"
  ON public.return_requests FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Org users can update return requests"
  ON public.return_requests FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete return requests"
  ON public.return_requests FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin());

-- Technician can view and create own return requests
CREATE POLICY "Technicians can view own return requests"
  ON public.return_requests FOR SELECT
  USING (technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid()));

CREATE POLICY "Technicians can create own return requests"
  ON public.return_requests FOR INSERT
  WITH CHECK (technician_id IN (SELECT id FROM public.technicians WHERE user_id = auth.uid()));

-- RLS Policies for return_request_items
CREATE POLICY "Org users can view return request items"
  ON public.return_request_items FOR SELECT
  USING (return_request_id IN (SELECT id FROM public.return_requests WHERE organization_id = get_user_organization_id()));

CREATE POLICY "Org users can create return request items"
  ON public.return_request_items FOR INSERT
  WITH CHECK (return_request_id IN (SELECT id FROM public.return_requests WHERE organization_id = get_user_organization_id() OR organization_id IS NULL));

CREATE POLICY "Org users can update return request items"
  ON public.return_request_items FOR UPDATE
  USING (return_request_id IN (SELECT id FROM public.return_requests WHERE organization_id = get_user_organization_id()));

CREATE POLICY "Org admins can delete return request items"
  ON public.return_request_items FOR DELETE
  USING (return_request_id IN (SELECT id FROM public.return_requests WHERE organization_id = get_user_organization_id()) AND is_org_admin());

-- Technician can view and create own return request items
CREATE POLICY "Technicians can view own return request items"
  ON public.return_request_items FOR SELECT
  USING (return_request_id IN (
    SELECT rr.id FROM public.return_requests rr
    JOIN public.technicians t ON rr.technician_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Technicians can create own return request items"
  ON public.return_request_items FOR INSERT
  WITH CHECK (return_request_id IN (
    SELECT rr.id FROM public.return_requests rr
    JOIN public.technicians t ON rr.technician_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technician_dispatches_updated_at
  BEFORE UPDATE ON public.technician_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technician_dispatch_items_updated_at
  BEFORE UPDATE ON public.technician_dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();