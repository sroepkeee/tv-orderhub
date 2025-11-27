-- Atualizar função handle_new_user para remover inserção duplicada
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department, location)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    COALESCE(new.raw_user_meta_data->>'department', NULL),
    COALESCE(new.raw_user_meta_data->>'location', NULL)
  );
  
  -- REMOVIDO: A criação do user_approval_status é feita pelo trigger
  -- auto_assign_role_on_signup() que é disparado após o INSERT em profiles
  
  RETURN new;
END;
$function$;