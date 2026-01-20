-- Vincular usuário compras@imply.com à organização Imply
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  is_active
) VALUES (
  '69aed6aa-5300-4e40-b66a-e71f3706db16', -- Imply
  'fd83fbda-8160-47d2-bbe0-546938a8b160', -- compras@imply.com
  'member',
  true
)
ON CONFLICT (organization_id, user_id) DO UPDATE SET is_active = true;