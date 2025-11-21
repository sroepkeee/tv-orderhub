-- Criar configuração da fase 'completion' no phase_config
INSERT INTO phase_config (phase_key, display_name, description, icon, color, order_index, responsible_role)
VALUES (
  'completion',
  'Conclusão',
  'Pedidos concluídos (entregues, cancelados, devolvidos, etc.)',
  'CheckCircle2',
  'emerald',
  11,
  'completion'::app_role
)
ON CONFLICT (phase_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index,
  responsible_role = EXCLUDED.responsible_role;

-- Adicionar permissões para a fase 'completion'
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES
  ('completion'::app_role, 'completion', true, true, false),
  ('admin'::app_role, 'completion', true, true, true)
ON CONFLICT (role, phase_key) DO UPDATE
SET
  can_view   = EXCLUDED.can_view,
  can_edit   = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;