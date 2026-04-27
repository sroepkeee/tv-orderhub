-- Recria a view de "Solicitados Faturamento" baseada em order_history
-- (transições efetivas para statuses de faturamento, não status atual)
DROP VIEW IF EXISTS public.v_orders_invoice_requested_daily CASCADE;

CREATE VIEW public.v_orders_invoice_requested_daily AS
SELECT
  DATE(oh.changed_at) AS request_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(DISTINCT oh.order_id) AS orders_invoice_requested
FROM public.order_history oh
JOIN public.orders o ON o.id = oh.order_id
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE oh.new_status IN (
  'invoice_requested','ready_to_invoice','pending_invoice_request',
  'awaiting_invoice','invoice_issued','invoice_sent'
)
  AND (oh.old_status IS NULL OR oh.old_status NOT IN (
    'invoice_requested','ready_to_invoice','pending_invoice_request',
    'awaiting_invoice','invoice_issued','invoice_sent'
  ))
GROUP BY DATE(oh.changed_at), o.user_id, o.organization_id, p.full_name, p.email;

-- Recria a view de "Concluídos" usando data real de conclusão (changed_at)
DROP VIEW IF EXISTS public.v_orders_completed_daily CASCADE;

CREATE VIEW public.v_orders_completed_daily AS
SELECT
  DATE(oh.changed_at) AS completion_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(DISTINCT oh.order_id) AS orders_completed
FROM public.order_history oh
JOIN public.orders o ON o.id = oh.order_id
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE oh.new_status IN ('completed','delivered')
  AND (oh.old_status IS NULL OR oh.old_status NOT IN ('completed','delivered'))
GROUP BY DATE(oh.changed_at), o.user_id, o.organization_id, p.full_name, p.email;