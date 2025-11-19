-- Limpar permissões atuais
DELETE FROM phase_permissions;

-- Configurar permissões contextuais (fase anterior + principal + próxima)
-- Estrutura: cada role tem permissão TOTAL na sua fase principal
--            e permissão de VISUALIZAÇÃO nas fases adjacentes

-- 1. almox_ssm (primeira fase: vê sua fase + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_ssm', 'almox_ssm', true, true, true),           -- Fase principal
('almox_ssm', 'order_generation', true, false, false);  -- Próxima fase

-- 2. order_generation (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('order_generation', 'almox_ssm', true, false, false),        -- Fase anterior
('order_generation', 'order_generation', true, true, true),   -- Fase principal
('order_generation', 'almox_general', true, false, false);    -- Próxima fase

-- 3. almox_general (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_general', 'order_generation', true, false, false),   -- Fase anterior
('almox_general', 'almox_general', true, true, true),        -- Fase principal
('almox_general', 'production', true, false, false);         -- Próxima fase

-- 4. production (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('production', 'almox_general', true, false, false),          -- Fase anterior
('production', 'production', true, true, true),               -- Fase principal
('production', 'balance_generation', true, false, false);     -- Próxima fase

-- 5. balance_generation (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('balance_generation', 'production', true, false, false),           -- Fase anterior
('balance_generation', 'balance_generation', true, true, true),     -- Fase principal
('balance_generation', 'laboratory', true, false, false);           -- Próxima fase

-- 6. laboratory (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('laboratory', 'balance_generation', true, false, false),    -- Fase anterior
('laboratory', 'laboratory', true, true, true),              -- Fase principal
('laboratory', 'packaging', true, false, false);             -- Próxima fase

-- 7. packaging (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('packaging', 'laboratory', true, false, false),           -- Fase anterior
('packaging', 'packaging', true, true, true),              -- Fase principal
('packaging', 'freight_quote', true, false, false);        -- Próxima fase

-- 8. freight_quote (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('freight_quote', 'packaging', true, false, false),         -- Fase anterior
('freight_quote', 'freight_quote', true, true, true),       -- Fase principal
('freight_quote', 'invoicing', true, false, false);         -- Próxima fase

-- 9. invoicing (vê anterior + sua + próxima)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('invoicing', 'freight_quote', true, false, false),      -- Fase anterior
('invoicing', 'invoicing', true, true, true),            -- Fase principal
('invoicing', 'logistics', true, false, false);          -- Próxima fase

-- 10. logistics (última fase: vê anterior + sua fase)
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('logistics', 'invoicing', true, false, false),          -- Fase anterior
('logistics', 'logistics', true, true, true);            -- Fase principal

-- Admin mantém acesso total a tudo (já gerenciado via código)