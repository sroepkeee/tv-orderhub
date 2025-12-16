-- Criar tabela para armazenar mídia do WhatsApp
CREATE TABLE public.whatsapp_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.carrier_conversations(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'document', 'video', 'sticker')),
  mime_type TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,
  base64_data TEXT,
  storage_path TEXT,
  thumbnail_base64 TEXT,
  duration_seconds INTEGER,
  caption TEXT,
  media_key TEXT,
  direct_path TEXT,
  file_sha256 TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  compliance_check JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar campos de mídia em carrier_conversations
ALTER TABLE public.carrier_conversations 
ADD COLUMN IF NOT EXISTS has_media BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}'::jsonb;

-- Criar índices para performance
CREATE INDEX idx_whatsapp_media_conversation_id ON public.whatsapp_media(conversation_id);
CREATE INDEX idx_whatsapp_media_media_type ON public.whatsapp_media(media_type);
CREATE INDEX idx_whatsapp_media_created_at ON public.whatsapp_media(created_at DESC);
CREATE INDEX idx_carrier_conversations_has_media ON public.carrier_conversations(has_media) WHERE has_media = TRUE;

-- Habilitar RLS
ALTER TABLE public.whatsapp_media ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para whatsapp_media
CREATE POLICY "Authenticated users can view media"
ON public.whatsapp_media FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert media"
ON public.whatsapp_media FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update media"
ON public.whatsapp_media FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete media"
ON public.whatsapp_media FOR DELETE
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_media_updated_at
BEFORE UPDATE ON public.whatsapp_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para armazenar arquivos grandes
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para whatsapp-media bucket
CREATE POLICY "Authenticated users can view whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY "System can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "System can update whatsapp media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "System can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');