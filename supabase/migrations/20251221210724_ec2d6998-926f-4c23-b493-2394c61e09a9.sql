-- Criar tabela de gestores por fase
CREATE TABLE public.phase_managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  whatsapp TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  receive_new_orders BOOLEAN DEFAULT true,
  receive_urgent_alerts BOOLEAN DEFAULT true,
  receive_daily_summary BOOLEAN DEFAULT false,
  notification_priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE(phase_key, user_id, organization_id)
);

-- Índices para performance
CREATE INDEX idx_phase_managers_phase_key ON public.phase_managers(phase_key);
CREATE INDEX idx_phase_managers_org ON public.phase_managers(organization_id);
CREATE INDEX idx_phase_managers_active ON public.phase_managers(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.phase_managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org admins can manage phase managers"
ON public.phase_managers
FOR ALL
USING (
  (organization_id = get_user_organization_id() AND is_org_admin())
  OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (organization_id = get_user_organization_id() AND is_org_admin())
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Org users can view phase managers"
ON public.phase_managers
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Trigger para updated_at
CREATE TRIGGER update_phase_managers_updated_at
BEFORE UPDATE ON public.phase_managers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para buscar gestor de uma fase
CREATE OR REPLACE FUNCTION public.get_phase_manager(_phase_key TEXT, _org_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  whatsapp TEXT,
  full_name TEXT,
  receive_new_orders BOOLEAN,
  receive_urgent_alerts BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pm.user_id,
    pm.whatsapp,
    p.full_name,
    pm.receive_new_orders,
    pm.receive_urgent_alerts
  FROM phase_managers pm
  JOIN profiles p ON p.id = pm.user_id
  WHERE pm.phase_key = _phase_key
    AND pm.is_active = true
    AND (pm.organization_id = COALESCE(_org_id, get_user_organization_id()))
  ORDER BY pm.notification_priority ASC
  LIMIT 1;
$$;

-- Criar tabela de log de notificações de gestores
CREATE TABLE public.phase_manager_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_manager_id UUID REFERENCES public.phase_managers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'new_order', 'urgent_alert', 'status_change'
  message_content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_phase_manager_notifications_order ON public.phase_manager_notifications(order_id);
CREATE INDEX idx_phase_manager_notifications_status ON public.phase_manager_notifications(status);

-- Enable RLS
ALTER TABLE public.phase_manager_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all notifications"
ON public.phase_manager_notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR is_org_admin());

CREATE POLICY "System can manage notifications"
ON public.phase_manager_notifications
FOR ALL
USING (true)
WITH CHECK (true);