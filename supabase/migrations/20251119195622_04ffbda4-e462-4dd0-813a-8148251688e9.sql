-- Limpar permissões atuais
DELETE FROM phase_permissions;

-- Configurar permissões restritivas otimizadas
-- Cada role vê: sua fase (full) + próxima fase (view only)

-- 1. almox_ssm
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_ssm', 'almox_ssm', true, true, true),
('almox_ssm', 'order_generation', true, false, false);

-- 2. order_generation
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('order_generation', 'order_generation', true, true, true),
('order_generation', 'almox_general', true, false, false);

-- 3. almox_general
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_general', 'almox_general', true, true, true),
('almox_general', 'production', true, false, false);

-- 4. production
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('production', 'production', true, true, true),
('production', 'balance_generation', true, false, false);

-- 5. balance_generation
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('balance_generation', 'balance_generation', true, true, true),
('balance_generation', 'laboratory', true, false, false);

-- 6. laboratory
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('laboratory', 'laboratory', true, true, true),
('laboratory', 'packaging', true, false, false);

-- 7. packaging
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('packaging', 'packaging', true, true, true),
('packaging', 'freight_quote', true, false, false);

-- 8. freight_quote
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('freight_quote', 'freight_quote', true, true, true),
('freight_quote', 'invoicing', true, false, false);

-- 9. invoicing
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('invoicing', 'invoicing', true, true, true),
('invoicing', 'logistics', true, false, false);

-- 10. logistics (última fase - sem próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('logistics', 'logistics', true, true, true);