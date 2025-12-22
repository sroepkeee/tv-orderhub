-- Remover políticas permissivas
DROP POLICY IF EXISTS "System can manage message logs" ON public.whatsapp_message_log;
DROP POLICY IF EXISTS "Authorized users can view message logs" ON public.whatsapp_message_log;
DROP POLICY IF EXISTS "Org users can view whatsapp logs" ON public.whatsapp_message_log;
DROP POLICY IF EXISTS "Org users can create whatsapp logs" ON public.whatsapp_message_log;

-- Política 1: Apenas AI admins podem visualizar logs
CREATE POLICY "AI admins can view whatsapp logs"
ON public.whatsapp_message_log
FOR SELECT
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()));

-- Política 2: Apenas AI admins podem inserir logs
CREATE POLICY "AI admins can insert whatsapp logs"
ON public.whatsapp_message_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_ai_agent_admin(auth.uid()));

-- Política 3: Apenas AI admins podem atualizar logs
CREATE POLICY "AI admins can update whatsapp logs"
ON public.whatsapp_message_log
FOR UPDATE
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()))
WITH CHECK (public.is_ai_agent_admin(auth.uid()));

-- Política 4: Apenas AI admins podem deletar logs
CREATE POLICY "AI admins can delete whatsapp logs"
ON public.whatsapp_message_log
FOR DELETE
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()));

-- Política 5: Service role (Edge Functions) mantém acesso total
CREATE POLICY "Service role manages whatsapp logs"
ON public.whatsapp_message_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);