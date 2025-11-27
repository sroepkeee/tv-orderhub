-- Adicionar campo name na tabela whatsapp_instances para permitir nomes personalizados
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS name text DEFAULT 'Imply Frete';