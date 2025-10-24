-- Tornar campos opcionais na tabela carriers para permitir importação de dados incompletos

-- Tornar o campo 'email' opcional (pode ser NULL)
ALTER TABLE public.carriers 
ALTER COLUMN email DROP NOT NULL;

-- Tornar o campo 'contact_person' opcional (pode ser NULL)
ALTER TABLE public.carriers 
ALTER COLUMN contact_person DROP NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.carriers.email IS 'Email principal da transportadora (opcional, pode ser preenchido depois)';
COMMENT ON COLUMN public.carriers.contact_person IS 'Pessoa de contato principal (opcional, pode ser preenchido depois)';