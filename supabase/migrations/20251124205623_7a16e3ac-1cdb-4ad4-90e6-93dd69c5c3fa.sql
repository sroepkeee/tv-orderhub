-- Add in_transit phase configuration
INSERT INTO phase_config (phase_key, display_name, description, responsible_role, icon, color, order_index)
VALUES ('in_transit', 'Em Trânsito', 'Pedidos em trânsito para entrega', 'in_transit', 'Truck', 'blue', 11)
ON CONFLICT (phase_key) DO NOTHING;

-- Add permissions for in_transit role
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
VALUES ('in_transit', 'in_transit', true, true, false)
ON CONFLICT DO NOTHING;