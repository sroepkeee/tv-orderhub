-- Tabela para tracking de confirmações de entrega
CREATE TABLE public.delivery_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_whatsapp TEXT NOT NULL,
  customer_name TEXT,
  
  -- Status do pedido quando enviado
  order_status TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Resposta do cliente
  response_received BOOLEAN DEFAULT false,
  response_type TEXT, -- 'confirmed' | 'not_received' | 'invalid_response' | 'no_response'
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  
  -- Tracking de tentativas
  attempts_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  max_attempts INTEGER DEFAULT 3,
  
  -- Para análise interna se não recebeu
  requires_analysis BOOLEAN DEFAULT false,
  analysis_notes TEXT,
  analyzed_by UUID REFERENCES auth.users(id),
  analyzed_at TIMESTAMPTZ,
  
  -- Metadata
  notification_log_id UUID REFERENCES public.ai_notification_log(id),
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_delivery_confirmations_order_id ON public.delivery_confirmations(order_id);
CREATE INDEX idx_delivery_confirmations_pending ON public.delivery_confirmations(response_received, sent_at) WHERE response_received = false;
CREATE INDEX idx_delivery_confirmations_requires_analysis ON public.delivery_confirmations(requires_analysis) WHERE requires_analysis = true;
CREATE INDEX idx_delivery_confirmations_org ON public.delivery_confirmations(organization_id);

-- RLS
ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view delivery confirmations of their organization" 
ON public.delivery_confirmations FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update delivery confirmations of their organization" 
ON public.delivery_confirmations FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Tabela de configuração do gatilho de confirmação de entrega
CREATE TABLE public.delivery_confirmation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Configurações principais
  is_active BOOLEAN DEFAULT true,
  trigger_after_hours INTEGER DEFAULT 48, -- Horas após entrar em "em_transito"
  trigger_status TEXT[] DEFAULT ARRAY['in_transit', 'em_transito', 'delivered', 'entregue'],
  
  -- Mensagem customizada
  message_template TEXT DEFAULT '📦 Olá! Aqui é da {{empresa}}. 

Seu pedido *#{{numero_pedido}}* foi enviado há alguns dias.

*A entrega foi realizada com sucesso?*

Responda:
✅ *SIM* - Recebi meu pedido
❌ *NÃO* - Ainda não recebi

Se não recebeu, por favor nos informe para abrirmos uma análise.',
  
  -- Follow-up se não responder
  followup_enabled BOOLEAN DEFAULT true,
  followup_after_hours INTEGER DEFAULT 24,
  followup_message_template TEXT DEFAULT '📦 Olá! Ainda não recebemos sua confirmação.

Seu pedido *#{{numero_pedido}}* chegou?

Responda *SIM* ou *NÃO* para nos ajudar.',

  -- Configurações de retry
  max_attempts INTEGER DEFAULT 3,
  retry_interval_hours INTEGER DEFAULT 24,
  
  -- Ações automáticas
  auto_complete_on_confirm BOOLEAN DEFAULT true, -- Marcar pedido como concluído ao confirmar
  auto_create_analysis_on_not_received BOOLEAN DEFAULT true, -- Criar análise interna
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- RLS para config
ALTER TABLE public.delivery_confirmation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view config of their organization" 
ON public.delivery_confirmation_config FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update config of their organization" 
ON public.delivery_confirmation_config FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert config for their organization" 
ON public.delivery_confirmation_config FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_delivery_confirmations_updated_at
BEFORE UPDATE ON public.delivery_confirmations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_confirmation_config_updated_at
BEFORE UPDATE ON public.delivery_confirmation_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();