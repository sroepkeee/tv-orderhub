-- Views para indicadores de produtividade e integração Power BI

-- 1. View: Pedidos importados por dia/usuário
CREATE OR REPLACE VIEW public.v_orders_imported_daily 
WITH (security_invoker = true) AS
SELECT 
  DATE(o.created_at) AS import_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(*) AS orders_imported,
  COUNT(DISTINCT o.customer_name) AS unique_customers
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
GROUP BY DATE(o.created_at), o.user_id, o.organization_id, p.full_name, p.email;

-- 2. View: Pedidos solicitados para faturamento por dia/usuário
CREATE OR REPLACE VIEW public.v_orders_invoice_requested_daily 
WITH (security_invoker = true) AS
SELECT 
  DATE(o.updated_at) AS request_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(*) AS orders_invoice_requested
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status IN ('invoice_requested', 'ready_to_invoice', 'pending_invoice_request', 'awaiting_invoice', 'invoice_issued', 'invoice_sent')
GROUP BY DATE(o.updated_at), o.user_id, o.organization_id, p.full_name, p.email;

-- 3. View: Pedidos concluídos por dia/usuário
CREATE OR REPLACE VIEW public.v_orders_completed_daily 
WITH (security_invoker = true) AS
SELECT 
  DATE(o.updated_at) AS completion_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(*) AS orders_completed
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
WHERE o.status IN ('completed', 'delivered')
GROUP BY DATE(o.updated_at), o.user_id, o.organization_id, p.full_name, p.email;

-- Comentários para documentação
COMMENT ON VIEW public.v_orders_imported_daily IS 'Métricas diárias de pedidos importados por usuário e organização. Usado em dashboards de produtividade e Power BI.';
COMMENT ON VIEW public.v_orders_invoice_requested_daily IS 'Métricas diárias de pedidos com solicitação de faturamento por usuário e organização.';
COMMENT ON VIEW public.v_orders_completed_daily IS 'Métricas diárias de pedidos concluídos/entregues por usuário e organização.';