-- Corrigir search_path da função is_ai_agent_admin (já estava correto, mas garantindo)
CREATE OR REPLACE FUNCTION public.is_ai_agent_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.ai_agent_admins aa
    JOIN auth.users u ON u.email = aa.email
    WHERE u.id = _user_id AND aa.is_active = true
  );
$$;