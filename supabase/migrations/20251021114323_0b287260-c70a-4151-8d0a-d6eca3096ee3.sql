-- Atualizar configurações do bucket order-attachments
-- Permitir múltiplos tipos de arquivo e aumentar limite para 20MB

UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[],
  file_size_limit = 20971520,  -- 20MB em bytes
  public = true
WHERE id = 'order-attachments';