-- Update handle_new_user trigger to support OAuth data from Azure/Microsoft
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
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',  -- Azure/Microsoft returns 'name'
      ''
    ),
    COALESCE(new.raw_user_meta_data->>'department', NULL),
    COALESCE(new.raw_user_meta_data->>'location', NULL)
  );
  
  -- Create default approval status
  INSERT INTO public.user_approval_status (user_id, status)
  VALUES (new.id, 'pending');
  
  RETURN new;
END;
$$;