-- Adicionar coluna phone_format na tabela carriers para armazenar o formato preferido do número
ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS phone_format text DEFAULT NULL;

-- Comentário explicando os valores possíveis
COMMENT ON COLUMN public.carriers.phone_format IS 'Formato do telefone: with_nine (13 dígitos) ou without_nine (12 dígitos)';

-- Também adicionar na tabela customer_contacts para clientes
ALTER TABLE public.customer_contacts ADD COLUMN IF NOT EXISTS phone_format text DEFAULT NULL;

COMMENT ON COLUMN public.customer_contacts.phone_format IS 'Formato do telefone: with_nine (13 dígitos) ou without_nine (12 dígitos)';