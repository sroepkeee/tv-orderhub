-- ========================================
-- CONFIGURAÇÃO COMPLETA DE PERMISSÕES POR FASE
-- Regra: cada role vê fase anterior + própria + seguinte
-- ========================================

-- Limpar TODAS as permissões existentes (incluindo admin)
DELETE FROM phase_permissions;

-- ========================================
-- 1. ALMOX_SSM (order_index 1)
-- Sem anterior | própria | order_generation
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_ssm', 'almox_ssm', true, true, false),
('almox_ssm', 'order_generation', true, false, false);

-- ========================================
-- 2. ORDER_GENERATION (order_index 2)
-- almox_ssm | própria | almox_general
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('order_generation', 'almox_ssm', true, false, false),
('order_generation', 'order_generation', true, true, false),
('order_generation', 'almox_general', true, false, false);

-- ========================================
-- 3. ALMOX_GENERAL (order_index 3)
-- order_generation | própria | purchases
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('almox_general', 'order_generation', true, false, false),
('almox_general', 'almox_general', true, true, false),
('almox_general', 'purchases', true, false, false);

-- ========================================
-- 4. PURCHASES (order_index 4)
-- almox_general | própria | production_client
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('purchases', 'almox_general', true, false, false),
('purchases', 'purchases', true, true, false),
('purchases', 'production_client', true, false, false);

-- ========================================
-- 5. PRODUCTION_CLIENT (order_index 5)
-- purchases | própria | production_stock
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('production_client', 'purchases', true, false, false),
('production_client', 'production_client', true, true, false),
('production_client', 'production_stock', true, false, false);

-- ========================================
-- 6. PRODUCTION_STOCK (order_index 6)
-- production_client | própria | balance_generation
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('production_stock', 'production_client', true, false, false),
('production_stock', 'production_stock', true, true, false),
('production_stock', 'balance_generation', true, false, false);

-- ========================================
-- 7. BALANCE_GENERATION (order_index 7)
-- production_stock | própria | laboratory
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('balance_generation', 'production_stock', true, false, false),
('balance_generation', 'balance_generation', true, true, false),
('balance_generation', 'laboratory', true, false, false);

-- ========================================
-- 8. LABORATORY (order_index 8)
-- balance_generation | própria | packaging
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('laboratory', 'balance_generation', true, false, false),
('laboratory', 'laboratory', true, true, false),
('laboratory', 'packaging', true, false, false);

-- ========================================
-- 9. PACKAGING (order_index 9)
-- laboratory | própria | freight_quote
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('packaging', 'laboratory', true, false, false),
('packaging', 'packaging', true, true, false),
('packaging', 'freight_quote', true, false, false);

-- ========================================
-- 10. FREIGHT_QUOTE (order_index 10)
-- packaging | própria | ready_to_invoice
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('freight_quote', 'packaging', true, false, false),
('freight_quote', 'freight_quote', true, true, false),
('freight_quote', 'ready_to_invoice', true, false, false);

-- ========================================
-- 11. READY_TO_INVOICE (order_index 11)
-- freight_quote | própria | invoicing
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('ready_to_invoice', 'freight_quote', true, false, false),
('ready_to_invoice', 'ready_to_invoice', true, true, false),
('ready_to_invoice', 'invoicing', true, false, false);

-- ========================================
-- 12. INVOICING (order_index 12)
-- ready_to_invoice | própria | logistics
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('invoicing', 'ready_to_invoice', true, false, false),
('invoicing', 'invoicing', true, true, false),
('invoicing', 'logistics', true, false, false);

-- ========================================
-- 13. LOGISTICS (order_index 13)
-- invoicing | própria | in_transit
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('logistics', 'invoicing', true, false, false),
('logistics', 'logistics', true, true, false),
('logistics', 'in_transit', true, false, false);

-- ========================================
-- 14. IN_TRANSIT (order_index 14)
-- logistics | própria | completion
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('in_transit', 'logistics', true, false, false),
('in_transit', 'in_transit', true, true, false),
('in_transit', 'completion', true, false, false);

-- ========================================
-- 15. COMPLETION (order_index 15)
-- in_transit | própria | sem seguinte
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('completion', 'in_transit', true, false, false),
('completion', 'completion', true, true, false);

-- ========================================
-- 16. CARRIERS_CHAT (comunicação - especial)
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('carriers_chat', 'carriers_chat', true, true, false);

-- ========================================
-- ADMIN: acesso total a todas as fases
-- ========================================
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
('admin', 'almox_ssm', true, true, true),
('admin', 'order_generation', true, true, true),
('admin', 'almox_general', true, true, true),
('admin', 'purchases', true, true, true),
('admin', 'production_client', true, true, true),
('admin', 'production_stock', true, true, true),
('admin', 'balance_generation', true, true, true),
('admin', 'laboratory', true, true, true),
('admin', 'packaging', true, true, true),
('admin', 'freight_quote', true, true, true),
('admin', 'ready_to_invoice', true, true, true),
('admin', 'invoicing', true, true, true),
('admin', 'logistics', true, true, true),
('admin', 'in_transit', true, true, true),
('admin', 'completion', true, true, true),
('admin', 'carriers_chat', true, true, true);