-- Criar tabela para cache de QR codes e instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_key TEXT UNIQUE NOT NULL,
  qrcode TEXT,
  qrcode_updated_at TIMESTAMPTZ,
  status TEXT DEFAULT 'disconnected',
  phone_number TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Policy: Admins e usuários autorizados podem visualizar
CREATE POLICY "Authorized users can view instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_authorized_users
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: System (service role) pode gerenciar tudo
CREATE POLICY "Service role can manage instances"
ON public.whatsapp_instances
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);