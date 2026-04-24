-- =========================================================
-- Padronizar views de produtividade pelo created_at
-- =========================================================

-- 1) Faturamento solicitado: agora indexado por created_at
CREATE OR REPLACE VIEW public.v_orders_invoice_requested_daily
WITH (security_invoker = true)
AS
SELECT
  DATE(o.created_at) AS request_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(*) AS orders_invoice_requested
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status = ANY (ARRAY[
  'invoice_requested','ready_to_invoice','pending_invoice_request',
  'awaiting_invoice','invoice_issued','invoice_sent'
])
GROUP BY DATE(o.created_at), o.user_id, o.organization_id, p.full_name, p.email;

GRANT SELECT ON public.v_orders_invoice_requested_daily TO authenticated;

-- 2) Concluídos: agora indexado por created_at
CREATE OR REPLACE VIEW public.v_orders_completed_daily
WITH (security_invoker = true)
AS
SELECT
  DATE(o.created_at) AS completion_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(*) AS orders_completed
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status IN ('completed', 'delivered')
GROUP BY DATE(o.created_at), o.user_id, o.organization_id, p.full_name, p.email;

GRANT SELECT ON public.v_orders_completed_daily TO authenticated;

-- 3) SLA diário: indexado por created_at; métricas on-time mantêm delivery_date/shipping_date
CREATE OR REPLACE VIEW public.v_productivity_sla_daily
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    o.organization_id,
    DATE(o.created_at) AS activity_date,
    o.user_id,
    p.full_name AS user_name,
    p.email AS user_email,
    o.order_type,
    COALESCE(o.order_category, 'unknown') AS order_category,
    COALESCE(o.priority, 'normal') AS priority,
    o.id AS order_id,
    o.sla_status,
    o.delivery_date,
    o.shipping_date,
    CASE
      WHEN o.shipping_date IS NOT NULL AND o.delivery_date IS NOT NULL THEN
        CASE WHEN o.shipping_date <= o.delivery_date THEN 1 ELSE 0 END
      WHEN o.delivery_date IS NOT NULL THEN
        CASE WHEN DATE(o.updated_at) <= o.delivery_date THEN 1 ELSE 0 END
      ELSE NULL
    END AS on_time_flag
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.status IN ('completed', 'delivered')
)
SELECT
  organization_id,
  activity_date,
  user_id,
  user_name,
  user_email,
  order_type,
  order_category,
  priority,
  COUNT(*) AS total_completed,
  COUNT(*) FILTER (WHERE on_time_flag = 1) AS on_time_count,
  COUNT(*) FILTER (WHERE on_time_flag = 0) AS late_count,
  COUNT(*) FILTER (WHERE sla_status = 'on_time') AS sla_on_time,
  COUNT(*) FILTER (WHERE sla_status = 'at_risk') AS sla_at_risk,
  COUNT(*) FILTER (WHERE sla_status IN ('late', 'overdue')) AS sla_late,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE on_time_flag = 1)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE on_time_flag IS NOT NULL), 0),
    1
  ) AS on_time_percent
FROM base
GROUP BY organization_id, activity_date, user_id, user_name, user_email, order_type, order_category, priority;

GRANT SELECT ON public.v_productivity_sla_daily TO authenticated;

-- 4) Cycle time: indexado por created_at
CREATE OR REPLACE VIEW public.v_productivity_cycle_time
WITH (security_invoker = true)
AS
SELECT
  o.organization_id,
  DATE(o.created_at) AS activity_date,
  o.user_id,
  p.full_name AS user_name,
  p.email AS user_email,
  o.order_type,
  COALESCE(o.order_category, 'unknown') AS order_category,
  COALESCE(o.priority, 'normal') AS priority,
  COUNT(*) AS orders_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 86400.0)::numeric, 1) AS avg_cycle_days,
  ROUND(MIN(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 86400.0)::numeric, 1) AS min_cycle_days,
  ROUND(MAX(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 86400.0)::numeric, 1) AS max_cycle_days
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status IN ('completed', 'delivered')
  AND o.created_at IS NOT NULL
GROUP BY o.organization_id, DATE(o.created_at),
         o.user_id, p.full_name, p.email, o.order_type, o.order_category, o.priority;

GRANT SELECT ON public.v_productivity_cycle_time TO authenticated;