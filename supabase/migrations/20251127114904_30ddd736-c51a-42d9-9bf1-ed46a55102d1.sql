-- Adicionar permissões para roles production_client e production_stock
INSERT INTO public.phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
-- Permissões para production_client
('production_client', 'production_client', true, true, true),
('production_client', 'almox_general', true, false, false),
('production_client', 'laboratory', true, false, false),
('production_client', 'packaging', true, false, false),

-- Permissões para production_stock
('production_stock', 'production_stock', true, true, true),
('production_stock', 'almox_general', true, false, false),
('production_stock', 'laboratory', true, false, false),
('production_stock', 'packaging', true, false, false)
ON CONFLICT (role, phase_key) DO NOTHING;