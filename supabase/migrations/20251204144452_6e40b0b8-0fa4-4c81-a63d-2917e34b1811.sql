-- Restaurar admin para Henrique schwengber (supervisor de Produção)
INSERT INTO user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM profiles p
WHERE p.full_name ILIKE 'Henrique schwengber%'
ON CONFLICT (user_id, role) DO NOTHING;