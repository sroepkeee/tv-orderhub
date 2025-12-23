-- Adicionar coluna customer_contact_name na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_contact_name text;

COMMENT ON COLUMN public.orders.customer_contact_name IS 
  'Nome do contato/negociador que receberá as notificações WhatsApp do pedido';