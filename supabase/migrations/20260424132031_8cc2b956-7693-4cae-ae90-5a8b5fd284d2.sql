
-- ============================================================
-- VIEW 1: SLA diário por usuário/tipo (para tab "SLA")
-- Usa updated_at como data da última mudança de estado e shipping_date para "data de entrega real"
-- ============================================================
CREATE OR REPLACE VIEW public.v_productivity_sla_daily
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    o.organization_id,
    DATE(COALESCE(o.shipping_date::timestamp, o.updated_at)) AS activity_date,
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

-- ============================================================
-- VIEW 2: Cycle time (dias entre criação e finalização) por usuário/tipo
-- ============================================================
CREATE OR REPLACE VIEW public.v_productivity_cycle_time
WITH (security_invoker = true)
AS
SELECT
  o.organization_id,
  DATE(COALESCE(o.shipping_date::timestamp, o.updated_at)) AS activity_date,
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
GROUP BY o.organization_id, DATE(COALESCE(o.shipping_date::timestamp, o.updated_at)),
         o.user_id, p.full_name, p.email, o.order_type, o.order_category, o.priority;

-- ============================================================
-- VIEW 3: Complexidade técnica (firmware/imagem) por usuário
-- ============================================================
CREATE OR REPLACE VIEW public.v_productivity_complexity_daily
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
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE o.requires_firmware = true) AS requires_firmware_count,
  COUNT(*) FILTER (WHERE o.requires_image = true) AS requires_image_count,
  COUNT(*) FILTER (WHERE o.requires_firmware = true OR o.requires_image = true) AS technical_complex_count,
  COUNT(*) FILTER (WHERE o.lab_completed_at IS NOT NULL) AS lab_processed_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE o.requires_firmware = true OR o.requires_image = true)::numeric
    / NULLIF(COUNT(*), 0),
    1
  ) AS complexity_percent
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.created_at IS NOT NULL
GROUP BY o.organization_id, DATE(o.created_at),
         o.user_id, p.full_name, p.email, o.order_type, o.order_category;

GRANT SELECT ON public.v_productivity_sla_daily TO authenticated;
GRANT SELECT ON public.v_productivity_cycle_time TO authenticated;
GRANT SELECT ON public.v_productivity_complexity_daily TO authenticated;
