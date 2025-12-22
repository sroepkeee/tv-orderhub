-- ==============================================
-- Parte 1: Limpar fases duplicadas
-- ==============================================
DELETE FROM phase_config WHERE phase_key IN (
  'entrada',
  'processamento',
  'revisao',
  'finalizacao',
  'entregue'
);

-- ==============================================
-- Parte 2: Adicionar campos de tempo na phase_config
-- ==============================================
ALTER TABLE phase_config 
  ADD COLUMN IF NOT EXISTS max_days_allowed INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS warning_days INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stall_alerts_enabled BOOLEAN DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN phase_config.max_days_allowed IS 'Número máximo de dias que um pedido pode ficar nesta fase antes de alerta crítico';
COMMENT ON COLUMN phase_config.warning_days IS 'Número de dias para enviar alerta de aviso antes do máximo';
COMMENT ON COLUMN phase_config.stall_alerts_enabled IS 'Se alertas de estagnação estão habilitados para esta fase';

-- ==============================================
-- Parte 3: Criar tabela de alertas de estagnação
-- ==============================================
CREATE TABLE IF NOT EXISTS public.phase_stall_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  manager_user_id UUID REFERENCES public.profiles(id),
  days_stalled INTEGER NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'warning' CHECK (alert_type IN ('warning', 'critical', 'escalation')),
  alerted_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'resolved')),
  notification_sent BOOLEAN DEFAULT false,
  whatsapp_message_id TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_phase_stall_alerts_order_id ON phase_stall_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_phase_stall_alerts_phase_key ON phase_stall_alerts(phase_key);
CREATE INDEX IF NOT EXISTS idx_phase_stall_alerts_status ON phase_stall_alerts(status);
CREATE INDEX IF NOT EXISTS idx_phase_stall_alerts_org ON phase_stall_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_phase_stall_alerts_manager ON phase_stall_alerts(manager_user_id);

-- Índice composto para evitar alertas duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_phase_stall_alerts_unique_active 
  ON phase_stall_alerts(order_id, phase_key, alert_type) 
  WHERE status IN ('pending', 'sent');

-- Habilitar RLS
ALTER TABLE phase_stall_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Org users can view their stall alerts"
  ON phase_stall_alerts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can create stall alerts"
  ON phase_stall_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Org users can update their stall alerts"
  ON phase_stall_alerts FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete stall alerts"
  ON phase_stall_alerts FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin());

-- ==============================================
-- Parte 4: Função auxiliar para propagar organization_id
-- ==============================================
CREATE OR REPLACE FUNCTION propagate_stall_alerts_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para propagar organization_id
DROP TRIGGER IF EXISTS propagate_stall_alerts_org_trigger ON phase_stall_alerts;
CREATE TRIGGER propagate_stall_alerts_org_trigger
  BEFORE INSERT ON phase_stall_alerts
  FOR EACH ROW
  EXECUTE FUNCTION propagate_stall_alerts_org();