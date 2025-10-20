-- Add department field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department TEXT CHECK (department IN ('Suporte', 'Almox SSM', 'Laboratório', 'Almox Geral', 'Expedição', 'Produção'));

COMMENT ON COLUMN public.profiles.department IS 'Área/departamento em que o usuário trabalha';