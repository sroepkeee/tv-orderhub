-- Adicionar coluna para vincular anexos a comentários
ALTER TABLE public.order_attachments 
  ADD COLUMN comment_id uuid REFERENCES public.order_comments(id) ON DELETE CASCADE;

-- Tornar order_id nullable, pois agora pode estar vinculado a comentário
ALTER TABLE public.order_attachments 
  ALTER COLUMN order_id DROP NOT NULL;

-- Adicionar constraint: deve ter order_id OU comment_id
ALTER TABLE public.order_attachments
  ADD CONSTRAINT order_or_comment_required 
  CHECK (
    (order_id IS NOT NULL AND comment_id IS NULL) OR 
    (order_id IS NULL AND comment_id IS NOT NULL) OR
    (order_id IS NOT NULL AND comment_id IS NOT NULL)
  );

-- Adicionar índice para performance
CREATE INDEX idx_order_attachments_comment_id ON public.order_attachments(comment_id);

-- Comentário para documentação
COMMENT ON COLUMN public.order_attachments.comment_id IS 'ID do comentário associado (para imagens coladas em comentários)';