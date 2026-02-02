-- Remover APENAS a role admin (manter as 15 roles operacionais)
DELETE FROM user_roles 
WHERE user_id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b'
AND role = 'admin';

-- Reativar o perfil
UPDATE profiles 
SET is_active = true 
WHERE id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b';