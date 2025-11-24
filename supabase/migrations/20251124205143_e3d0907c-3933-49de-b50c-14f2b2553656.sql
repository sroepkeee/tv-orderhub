-- Step 2: Update phase_config and permissions
-- Update existing production phase to production_client
UPDATE phase_config 
SET phase_key = 'production_client',
    display_name = 'Produção Clientes',
    description = 'Produção de pedidos para clientes (vendas)',
    responsible_role = 'production_client'
WHERE phase_key = 'production';

-- Insert new production_stock phase
INSERT INTO phase_config (phase_key, display_name, description, responsible_role, icon, color, order_index)
VALUES ('production_stock', 'Produção Estoque', 'Produção para reposição de estoque', 'production_stock', 'Package', 'purple', 4)
ON CONFLICT (phase_key) DO NOTHING;

-- Reorder phase indexes (shift phases after production_stock)
UPDATE phase_config 
SET order_index = order_index + 1 
WHERE order_index >= 5 AND phase_key NOT IN ('production_client', 'production_stock');

-- Update phase_permissions from production to production_client
UPDATE phase_permissions 
SET phase_key = 'production_client'
WHERE phase_key = 'production';

-- Copy permissions to production_stock
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete)
SELECT role, 'production_stock', can_view, can_edit, can_delete
FROM phase_permissions
WHERE phase_key = 'production_client'
ON CONFLICT (role, phase_key) DO NOTHING;

-- Migrate existing users with production role to both new roles
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'production_client' 
FROM user_roles 
WHERE role = 'production'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'production_stock' 
FROM user_roles 
WHERE role = 'production'
ON CONFLICT (user_id, role) DO NOTHING;

-- Delete old production role (users now have the new specific roles)
DELETE FROM user_roles WHERE role = 'production';