-- View consolidada de produtividade por tipo/categoria/prioridade
CREATE OR REPLACE VIEW public.v_productivity_by_type_daily
WITH (security_invoker = true)
AS
SELECT
  date(o.created_at) AS activity_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COALESCE(o.order_type, 'unknown') AS order_type,
  COALESCE(o.order_category, 'unknown') AS order_category,
  COALESCE(o.priority, 'normal') AS priority,
  count(*) AS orders_imported,
  count(*) FILTER (
    WHERE o.status = ANY (ARRAY[
      'invoice_requested','ready_to_invoice','pending_invoice_request',
      'awaiting_invoice','invoice_issued','invoice_sent'
    ])
  ) AS orders_invoice_requested,
  count(*) FILTER (
    WHERE o.status = ANY (ARRAY['completed','delivered'])
  ) AS orders_completed,
  count(DISTINCT o.customer_name) AS unique_customers
FROM orders o
LEFT JOIN profiles p ON p.id = o.user_id
GROUP BY
  date(o.created_at),
  o.user_id,
  o.organization_id,
  p.full_name,
  p.email,
  o.order_type,
  o.order_category,
  o.priority;

GRANT SELECT ON public.v_productivity_by_type_daily TO authenticated;