-- Criar função para buscar roles disponíveis do enum app_role
CREATE OR REPLACE FUNCTION public.get_app_roles()
RETURNS TABLE (role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT unnest(enum_range(NULL::app_role))::text;
$$;