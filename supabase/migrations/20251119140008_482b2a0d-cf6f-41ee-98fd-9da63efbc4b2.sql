-- Adicionar coluna location na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN location text CHECK (location IN ('Filial', 'Matriz'));

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.location IS 'Localização do usuário: Filial ou Matriz';

-- Atualizar trigger handle_new_user para incluir location
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department, location)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'department', NULL),
    COALESCE(new.raw_user_meta_data->>'location', NULL)
  );
  RETURN new;
END;
$$;