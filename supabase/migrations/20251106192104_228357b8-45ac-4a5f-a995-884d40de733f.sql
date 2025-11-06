-- Criar tabela principal de solicitações de compra
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'partially_received', 'completed', 'cancelled')),
  request_type TEXT NOT NULL DEFAULT 'normal' CHECK (request_type IN ('normal', 'urgent', 'emergency')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  total_estimated_value NUMERIC(15,2) DEFAULT 0,
  expected_delivery_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens da solicitação de compra
CREATE TABLE public.purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id),
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'UND',
  requested_quantity NUMERIC(15,3) NOT NULL CHECK (requested_quantity > 0),
  approved_quantity NUMERIC(15,3),
  unit_price NUMERIC(15,2),
  total_price NUMERIC(15,2),
  warehouse TEXT NOT NULL,
  notes TEXT,
  item_status TEXT DEFAULT 'pending' CHECK (item_status IN ('pending', 'approved', 'rejected', 'partially_approved')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de rateio de custos
CREATE TABLE public.item_cost_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_item_id UUID NOT NULL REFERENCES public.purchase_request_items(id) ON DELETE CASCADE,
  business_unit TEXT NOT NULL,
  accounting_item TEXT,
  cost_center TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  allocation_percentage NUMERIC(5,2) NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
  allocated_quantity NUMERIC(15,3),
  allocated_value NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de histórico de compras anteriores
CREATE TABLE public.item_purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_price NUMERIC(15,2),
  supplier TEXT,
  purchase_order_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de informações de estoque
CREATE TABLE public.item_stock_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL UNIQUE,
  current_stock_quantity NUMERIC(15,3) DEFAULT 0,
  last_purchase_date DATE,
  last_purchase_quantity NUMERIC(15,3),
  last_purchase_price NUMERIC(15,2),
  minimum_stock_level NUMERIC(15,3),
  maximum_stock_level NUMERIC(15,3),
  warehouse TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de métricas de consumo
CREATE TABLE public.item_consumption_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL UNIQUE,
  consumption_30_days NUMERIC(15,3) DEFAULT 0,
  consumption_60_days NUMERIC(15,3) DEFAULT 0,
  consumption_90_days NUMERIC(15,3) DEFAULT 0,
  average_daily_consumption NUMERIC(15,3) DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_pr_status ON public.purchase_requests(status);
CREATE INDEX idx_pr_requested_by ON public.purchase_requests(requested_by);
CREATE INDEX idx_pr_order_number ON public.purchase_requests(purchase_order_number);
CREATE INDEX idx_pr_items_request ON public.purchase_request_items(purchase_request_id);
CREATE INDEX idx_pr_items_code ON public.purchase_request_items(item_code);
CREATE INDEX idx_pr_items_order ON public.purchase_request_items(order_item_id);
CREATE INDEX idx_cost_alloc_item ON public.item_cost_allocation(purchase_request_item_id);
CREATE INDEX idx_history_item_date ON public.item_purchase_history(item_code, purchase_date DESC);
CREATE INDEX idx_stock_item ON public.item_stock_info(item_code);
CREATE INDEX idx_consumption_item ON public.item_consumption_metrics(item_code);

-- Criar função para gerar número de OC
CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_order_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_requests
  WHERE purchase_order_number LIKE 'OC-' || year_part || '-%';
  
  RETURN 'OC-' || year_part || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$;

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_purchase_requests_updated_at
BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_request_items_updated_at
BEFORE UPDATE ON public.purchase_request_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para calcular totais automaticamente
CREATE OR REPLACE FUNCTION public.calculate_purchase_request_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar total_price do item
  IF NEW.unit_price IS NOT NULL AND NEW.requested_quantity IS NOT NULL THEN
    NEW.total_price := NEW.unit_price * NEW.requested_quantity;
  END IF;
  
  -- Atualizar total estimado da solicitação
  UPDATE public.purchase_requests
  SET total_estimated_value = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM public.purchase_request_items
    WHERE purchase_request_id = NEW.purchase_request_id
  )
  WHERE id = NEW.purchase_request_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_item_totals
BEFORE INSERT OR UPDATE ON public.purchase_request_items
FOR EACH ROW
EXECUTE FUNCTION public.calculate_purchase_request_totals();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_cost_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_stock_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_consumption_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para purchase_requests
CREATE POLICY "Authenticated users can view all purchase requests"
ON public.purchase_requests FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own purchase requests"
ON public.purchase_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update their draft requests"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (auth.uid() = requested_by AND status = 'draft');

CREATE POLICY "Admins and planejamento can update any request"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'planejamento')
);

CREATE POLICY "Admins can delete requests"
ON public.purchase_requests FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para purchase_request_items
CREATE POLICY "Authenticated users can view all items"
ON public.purchase_request_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage items in their requests"
ON public.purchase_request_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE id = purchase_request_items.purchase_request_id
    AND requested_by = auth.uid()
  )
);

CREATE POLICY "Admins and planejamento can manage all items"
ON public.purchase_request_items FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'planejamento')
);

-- Políticas RLS para item_cost_allocation
CREATE POLICY "Authenticated users can view allocations"
ON public.item_cost_allocation FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage allocations"
ON public.item_cost_allocation FOR ALL
TO authenticated
USING (true);

-- Políticas RLS para item_purchase_history
CREATE POLICY "Authenticated users can view purchase history"
ON public.item_purchase_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and planejamento can manage history"
ON public.item_purchase_history FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'planejamento')
);

-- Políticas RLS para item_stock_info
CREATE POLICY "Authenticated users can view stock info"
ON public.item_stock_info FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage stock info"
ON public.item_stock_info FOR ALL
TO authenticated
USING (true);

-- Políticas RLS para item_consumption_metrics
CREATE POLICY "Authenticated users can view consumption metrics"
ON public.item_consumption_metrics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage consumption metrics"
ON public.item_consumption_metrics FOR ALL
TO authenticated
USING (true);