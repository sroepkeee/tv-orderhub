-- Remover política permissiva existente
DROP POLICY IF EXISTS "System can manage pending replies" ON public.pending_ai_replies;

-- Política 1: Apenas admins de AI podem visualizar as respostas pendentes
CREATE POLICY "AI admins can view pending replies"
ON public.pending_ai_replies
FOR SELECT
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()));

-- Política 2: Apenas admins de AI podem inserir novas respostas pendentes
CREATE POLICY "AI admins can insert pending replies"
ON public.pending_ai_replies
FOR INSERT
TO authenticated
WITH CHECK (public.is_ai_agent_admin(auth.uid()));

-- Política 3: Apenas admins de AI podem atualizar respostas pendentes
CREATE POLICY "AI admins can update pending replies"
ON public.pending_ai_replies
FOR UPDATE
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()))
WITH CHECK (public.is_ai_agent_admin(auth.uid()));

-- Política 4: Apenas admins de AI podem deletar respostas pendentes
CREATE POLICY "AI admins can delete pending replies"
ON public.pending_ai_replies
FOR DELETE
TO authenticated
USING (public.is_ai_agent_admin(auth.uid()));

-- Política 5: Service role (Edge Functions) pode gerenciar todas as respostas
-- Esta política permite que as Edge Functions processem a fila de mensagens
CREATE POLICY "Service role manages pending replies"
ON public.pending_ai_replies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);