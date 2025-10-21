-- Adicionar tipo de pedido "Remessa em Garantia"
INSERT INTO public.order_type_config (
  order_type,
  display_name,
  category,
  icon,
  description,
  default_sla_days,
  default_status,
  default_warehouse,
  stock_operation,
  operation_nature,
  cost_center,
  responsible_department,
  approval_required
) VALUES (
  'remessa_garantia',
  'Remessa em Garantia',
  'operacoes_especiais',
  '🛡️',
  'Envio de equipamentos cobertos por garantia para análise e reparo',
  7,
  'em_transito',
  'RMA',
  'temporary_exit',
  'Remessa Temporária - Garantia',
  'MAN-002',
  'Manutenção',
  true
);