-- Create table for manager trigger configurations
CREATE TABLE public.ai_manager_trigger_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'status_change',
  trigger_status TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  
  -- Campos de informação a incluir
  include_order_number BOOLEAN DEFAULT true,
  include_customer_name BOOLEAN DEFAULT true,
  include_item_count BOOLEAN DEFAULT true,
  include_total_value BOOLEAN DEFAULT true,
  include_status BOOLEAN DEFAULT true,
  include_delivery_date BOOLEAN DEFAULT false,
  include_days_until_delivery BOOLEAN DEFAULT false,
  include_phase_info BOOLEAN DEFAULT false,
  include_item_list BOOLEAN DEFAULT false,
  include_priority BOOLEAN DEFAULT false,
  
  -- Configurações de envio
  channels TEXT[] DEFAULT ARRAY['whatsapp'],
  priority INTEGER DEFAULT 5,
  delay_minutes INTEGER DEFAULT 0,
  
  -- Template customizado (opcional)
  custom_template TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_manager_trigger_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view triggers for their organization"
ON public.ai_manager_trigger_config
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Admins can manage triggers for their organization"
ON public.ai_manager_trigger_config
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_ai_manager_trigger_config_updated_at
BEFORE UPDATE ON public.ai_manager_trigger_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_ai_manager_trigger_config_org ON public.ai_manager_trigger_config(organization_id);
CREATE INDEX idx_ai_manager_trigger_config_active ON public.ai_manager_trigger_config(is_active) WHERE is_active = true;