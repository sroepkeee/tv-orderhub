-- ============================================
-- SISTEMA DE MENÇÕES E NOTIFICAÇÕES
-- ============================================

-- 1. TABELA DE NOTIFICAÇÕES
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo e conteúdo
  type TEXT NOT NULL DEFAULT 'mention',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Referências
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.order_comments(id) ON DELETE CASCADE,
  mentioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Estado
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. TABELA DE MENÇÕES
CREATE TABLE public.mention_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  comment_id UUID NOT NULL REFERENCES public.order_comments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_mention_tags_mentioned_user ON public.mention_tags(mentioned_user_id);
CREATE INDEX idx_mention_tags_comment ON public.mention_tags(comment_id);
CREATE INDEX idx_mention_tags_order ON public.mention_tags(order_id);

-- RLS
ALTER TABLE public.mention_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mention tags"
  ON public.mention_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create mention tags"
  ON public.mention_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = mentioned_by);

-- 3. FUNÇÃO PARA PROCESSAR MENÇÕES
CREATE OR REPLACE FUNCTION public.process_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern TEXT := '@\[([^\]]+)\]\(([a-f0-9-]{36})\)';
  mention_record RECORD;
  notification_id UUID;
  order_number_val TEXT;
  author_name TEXT;
BEGIN
  -- Buscar número do pedido e nome do autor
  SELECT o.order_number INTO order_number_val
  FROM orders o WHERE o.id = NEW.order_id;
  
  SELECT p.full_name INTO author_name
  FROM profiles p WHERE p.id = NEW.user_id;
  
  -- Extrair todas as menções do formato @[Nome](user-id)
  FOR mention_record IN
    SELECT DISTINCT
      (regexp_matches(NEW.comment, mention_pattern, 'g'))[1] AS user_name,
      (regexp_matches(NEW.comment, mention_pattern, 'g'))[2]::UUID AS user_id
  LOOP
    -- Não criar notificação se mencionou a si mesmo
    IF mention_record.user_id != NEW.user_id THEN
      -- Criar notificação
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        order_id,
        comment_id,
        mentioned_by,
        metadata
      ) VALUES (
        mention_record.user_id,
        'mention',
        'Você foi mencionado em um comentário',
        SUBSTRING(NEW.comment FROM 1 FOR 200),
        NEW.order_id,
        NEW.id,
        NEW.user_id,
        jsonb_build_object(
          'user_name', mention_record.user_name,
          'order_number', order_number_val,
          'author_name', COALESCE(author_name, 'Usuário')
        )
      )
      RETURNING id INTO notification_id;
      
      -- Registrar menção
      INSERT INTO public.mention_tags (
        comment_id,
        order_id,
        mentioned_user_id,
        mentioned_by,
        notification_id
      ) VALUES (
        NEW.id,
        NEW.order_id,
        mention_record.user_id,
        NEW.user_id,
        notification_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar menções ao criar comentário
CREATE TRIGGER process_mentions_on_comment
  AFTER INSERT ON public.order_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.process_comment_mentions();

-- Habilitar Realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;