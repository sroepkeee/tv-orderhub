-- 1. Atualizar order_index das fases existentes para abrir espaço
UPDATE phase_config 
SET order_index = order_index + 1 
WHERE order_index >= 9;

-- 2. Adicionar nova fase ready_to_invoice (À Faturar)
INSERT INTO phase_config (phase_key, display_name, responsible_role, order_index, color, icon, description)
VALUES (
  'ready_to_invoice',
  'À Faturar',
  'ready_to_invoice',
  9,
  'bg-purple-500',
  'FileText',
  'Pedidos prontos para solicitação de faturamento'
)
ON CONFLICT (phase_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    order_index = EXCLUDED.order_index;

-- 3. Adicionar permissões iniciais para ready_to_invoice
-- Admin tem acesso total
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('ready_to_invoice', 'admin', true, true, true)
ON CONFLICT (phase_key, role) DO UPDATE
SET can_view = true, can_edit = true, can_delete = true;

-- Role ready_to_invoice tem acesso total à sua fase
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('ready_to_invoice', 'ready_to_invoice', true, true, true)
ON CONFLICT (phase_key, role) DO NOTHING;

-- Role invoicing tem visualização da fase anterior
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('ready_to_invoice', 'invoicing', true, false, false)
ON CONFLICT (phase_key, role) DO NOTHING;