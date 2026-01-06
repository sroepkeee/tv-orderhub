-- Fix the overly permissive service role policy
DROP POLICY IF EXISTS "Service role pode atualizar qualquer convite" ON public.organization_invites;

-- Create a more specific policy for updating via token (for signup flow)
CREATE POLICY "Usuário pode aceitar próprio convite"
  ON public.organization_invites FOR UPDATE
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'accepted'
    AND used_by = auth.uid()
  );