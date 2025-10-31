-- Criar índices para melhorar performance de queries

-- Índice para ordenação de pedidos por data de criação
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Índice para join de itens com pedidos
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Índices para conversas de transportadoras
CREATE INDEX IF NOT EXISTS idx_cc_sent_at ON public.carrier_conversations(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_carrier_id ON public.carrier_conversations(carrier_id);
CREATE INDEX IF NOT EXISTS idx_cc_order_id ON public.carrier_conversations(order_id);

-- Índice parcial para mensagens não lidas (otimiza contador de não lidas)
CREATE INDEX IF NOT EXISTS idx_cc_unread_inbound 
ON public.carrier_conversations(sent_at DESC) 
WHERE message_direction = 'inbound' AND read_at IS NULL;