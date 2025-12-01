-- Inserir permissões padrão para a role carriers_chat
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('carriers_chat', 'carriers_chat', true, true, false)
ON CONFLICT (role, phase_key) DO NOTHING;