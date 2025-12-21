-- =====================================================
-- FIX: Restringir acesso a carrier_conversations por organização
-- =====================================================

-- Primeiro, dropar as políticas permissivas existentes
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.carrier_conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.carrier_conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.carrier_conversations;
DROP POLICY IF EXISTS "Authenticated users can delete conversations" ON public.carrier_conversations;

-- Criar função helper para verificar se usuário pode acessar conversas de uma transportadora
-- Usando SECURITY DEFINER para evitar recursão RLS
CREATE OR REPLACE FUNCTION public.can_access_carrier_conversation(p_carrier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.carriers c
    WHERE c.id = p_carrier_id 
      AND c.organization_id = get_user_organization_id()
  )
$$;

-- Políticas baseadas em organização (via carrier)

-- SELECT: Usuários podem ver apenas conversas de transportadoras da sua organização
CREATE POLICY "Org users can view their carrier conversations"
ON public.carrier_conversations
FOR SELECT
TO authenticated
USING (can_access_carrier_conversation(carrier_id));

-- INSERT: Usuários podem criar conversas apenas para transportadoras da sua organização
CREATE POLICY "Org users can create carrier conversations"
ON public.carrier_conversations
FOR INSERT
TO authenticated
WITH CHECK (can_access_carrier_conversation(carrier_id));

-- UPDATE: Usuários podem atualizar conversas de transportadoras da sua organização
CREATE POLICY "Org users can update their carrier conversations"
ON public.carrier_conversations
FOR UPDATE
TO authenticated
USING (can_access_carrier_conversation(carrier_id));

-- DELETE: Apenas admins da organização podem deletar conversas
CREATE POLICY "Org admins can delete carrier conversations"
ON public.carrier_conversations
FOR DELETE
TO authenticated
USING (can_access_carrier_conversation(carrier_id) AND is_org_admin());