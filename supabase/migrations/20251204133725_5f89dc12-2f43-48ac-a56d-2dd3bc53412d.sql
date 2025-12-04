-- Limpar permissões existentes de laboratory e packaging
DELETE FROM phase_permissions 
WHERE role IN ('laboratory', 'packaging');

-- Inserir permissões para role "laboratory" (anterior + própria + seguinte)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
-- Fase anterior (apenas visualização)
('laboratory', 'balance_generation', true, false, false),
-- Fase própria (visualização + edição)
('laboratory', 'laboratory', true, true, false),
-- Fase seguinte (apenas visualização)
('laboratory', 'packaging', true, false, false);

-- Inserir permissões para role "packaging" (anterior + própria + seguinte)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
-- Fase anterior (apenas visualização)
('packaging', 'laboratory', true, false, false),
-- Fase própria (visualização + edição)
('packaging', 'packaging', true, true, false),
-- Fase seguinte (apenas visualização)
('packaging', 'freight_quote', true, false, false);