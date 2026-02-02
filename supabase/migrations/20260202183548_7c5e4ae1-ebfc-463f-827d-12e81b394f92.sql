
-- Parte 1: Adicionar Luis Sehnem à organização Imply
INSERT INTO organization_members (organization_id, user_id, role, is_active)
VALUES (
  '69aed6aa-5300-4e40-b66a-e71f3706db16',
  'ea43e80b-cad3-48b3-b2eb-e40649a2d16b',
  'member',
  true
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Parte 2: Limpar roles excessivas e atribuir apenas admin
DELETE FROM user_roles 
WHERE user_id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b';

INSERT INTO user_roles (user_id, role)
VALUES ('ea43e80b-cad3-48b3-b2eb-e40649a2d16b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
