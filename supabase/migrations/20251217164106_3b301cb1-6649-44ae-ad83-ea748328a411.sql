-- Adicionar campos de rastreabilidade de notificação na tabela purchase_requests
ALTER TABLE public.purchase_requests 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS notification_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notification_recipients text[],
ADD COLUMN IF NOT EXISTS notification_count integer DEFAULT 0;

-- Criar índice para busca por order_id
CREATE INDEX IF NOT EXISTS idx_purchase_requests_order_id ON public.purchase_requests(order_id);

-- Comentários para documentação
COMMENT ON COLUMN public.purchase_requests.order_id IS 'Referência ao pedido original que originou a solicitação de compra';
COMMENT ON COLUMN public.purchase_requests.notification_sent_at IS 'Data/hora do último envio de e-mail de notificação';
COMMENT ON COLUMN public.purchase_requests.notification_recipients IS 'Lista de destinatários do e-mail de notificação';
COMMENT ON COLUMN public.purchase_requests.notification_count IS 'Contador de quantas vezes o e-mail foi enviado';