-- Criar tabela para controlar usuários autorizados a usar WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  authorized_by UUID REFERENCES public.profiles(id),
  authorized_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela para log detalhado de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.carrier_conversations(id) ON DELETE CASCADE,
  mega_message_id TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, read, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_authorized_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- RLS: Usuários autorizados podem ver seus próprios dados
CREATE POLICY "Users can view their own authorization"
  ON public.whatsapp_authorized_users
  FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- RLS: Admins podem gerenciar autorizações
CREATE POLICY "Admins can manage authorizations"
  ON public.whatsapp_authorized_users
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Usuários autorizados podem ver logs de mensagens
CREATE POLICY "Authorized users can view message logs"
  ON public.whatsapp_message_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_authorized_users
      WHERE user_id = auth.uid() AND is_active = true
    ) OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS: Sistema pode inserir/atualizar logs
CREATE POLICY "System can manage message logs"
  ON public.whatsapp_message_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Inserir usuários autorizados iniciais
INSERT INTO public.whatsapp_authorized_users (user_id)
SELECT id FROM public.profiles 
WHERE email IN ('dgassen@imply.com', 'cnascimento@imply.com.br')
ON CONFLICT (user_id) DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_authorized_users_user_id ON public.whatsapp_authorized_users(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_authorized_users_is_active ON public.whatsapp_authorized_users(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_log_conversation_id ON public.whatsapp_message_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_log_status ON public.whatsapp_message_log(status);