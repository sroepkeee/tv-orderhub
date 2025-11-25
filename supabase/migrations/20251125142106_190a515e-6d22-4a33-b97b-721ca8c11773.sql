-- Garantir que a fase de Compras existe na configuração
INSERT INTO phase_config (phase_key, display_name, responsible_role, description, icon, order_index, color)
VALUES (
  'purchases',
  'Compras',
  'purchases',
  'Gestão de solicitações de compras e suprimentos',
  'ShoppingCart',
  3,
  'hsl(var(--phase-purchases))'
)
ON CONFLICT (phase_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  responsible_role = EXCLUDED.responsible_role,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  order_index = EXCLUDED.order_index,
  color = EXCLUDED.color;

-- Garantir permissões padrão para a fase de Compras
-- O role purchases pode ver e editar a própria fase
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('purchases', 'purchases', true, true, false)
ON CONFLICT (phase_key, role) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Admin pode ver, editar e deletar tudo
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('purchases', 'admin', true, true, true)
ON CONFLICT (phase_key, role) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Planejamento pode ver a fase de compras (visibilidade para coordenação)
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES ('purchases', 'order_generation', true, false, false)
ON CONFLICT (phase_key, role) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;