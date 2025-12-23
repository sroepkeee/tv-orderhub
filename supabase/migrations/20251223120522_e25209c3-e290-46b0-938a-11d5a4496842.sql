-- Parte 1: Corrigir função can_view_phase para considerar user_phase_permissions
CREATE OR REPLACE FUNCTION public.can_view_phase(_user_id uuid, _phase_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Admin tem acesso total
    public.has_role(_user_id, 'admin') 
    OR
    -- Permissão via role (phase_permissions)
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.phase_permissions pp ON ur.role = pp.role
      WHERE ur.user_id = _user_id 
        AND pp.phase_key = _phase_key 
        AND pp.can_view = true
    )
    OR
    -- Permissão individual (user_phase_permissions)
    EXISTS (
      SELECT 1
      FROM public.user_phase_permissions upp
      WHERE upp.user_id = _user_id 
        AND upp.phase_key = _phase_key 
        AND upp.can_view = true
    )
$$;

-- Parte 2: Corrigir função can_edit_phase para considerar user_phase_permissions
CREATE OR REPLACE FUNCTION public.can_edit_phase(_user_id uuid, _phase text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Admin tem acesso total
    public.has_role(_user_id, 'admin')
    OR
    -- Permissão via role (phase_permissions)
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.phase_permissions pp ON ur.role = pp.role
      WHERE ur.user_id = _user_id 
        AND pp.phase_key = _phase 
        AND pp.can_edit = true
    )
    OR
    -- Permissão individual (user_phase_permissions)
    EXISTS (
      SELECT 1
      FROM public.user_phase_permissions upp
      WHERE upp.user_id = _user_id 
        AND upp.phase_key = _phase 
        AND upp.can_edit = true
    )
$$;