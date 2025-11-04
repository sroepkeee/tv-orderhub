-- Otimização de performance para notificações
-- Adicionar índices para melhorar queries de notificações

-- Índice composto para buscar notificações de um usuário ordenadas por data
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);

-- Índice parcial para notificações não lidas (mais eficiente)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, is_read) 
  WHERE is_read = false;

-- Índice para mentioned_by (usado no JOIN com profiles)
CREATE INDEX IF NOT EXISTS idx_notifications_mentioned_by
  ON public.notifications(mentioned_by)
  WHERE mentioned_by IS NOT NULL;

-- Adicionar foreign key explícita para mentioned_by -> profiles
-- Isso vai permitir que o Supabase reconheça o relacionamento na query select
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_mentioned_by_fkey'
  ) THEN
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_mentioned_by_fkey 
      FOREIGN KEY (mentioned_by) 
      REFERENCES public.profiles(id) 
      ON DELETE SET NULL;
  END IF;
END $$;