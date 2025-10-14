-- Criar bucket para anexos de pedidos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-attachments', 
  'order-attachments', 
  false,
  10485760,
  ARRAY['application/pdf']::text[]
);

-- Criar tabela para metadados dos anexos
CREATE TABLE IF NOT EXISTS public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL DEFAULT 'application/pdf',
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Todos usuários autenticados podem criar anexos
CREATE POLICY "Authenticated users can upload attachments"
ON public.order_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Policy: Todos usuários autenticados podem visualizar todos anexos
CREATE POLICY "All authenticated users can view all attachments"
ON public.order_attachments
FOR SELECT
TO authenticated
USING (true);

-- Policy: Apenas o uploader pode deletar seus anexos
CREATE POLICY "Users can delete their own attachments"
ON public.order_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Storage policies: Permitir todos usuários autenticados fazerem upload
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Todos usuários autenticados podem visualizar todos PDFs
CREATE POLICY "All authenticated users can view all PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'order-attachments');

-- Storage policy: Apenas o uploader pode deletar
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Criar índices para melhor performance
CREATE INDEX idx_order_attachments_order_id ON public.order_attachments(order_id);
CREATE INDEX idx_order_attachments_uploaded_by ON public.order_attachments(uploaded_by);