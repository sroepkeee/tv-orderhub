-- Adicionar permissões de fase para compras@imply.com (role purchases)
INSERT INTO user_phase_permissions (user_id, phase_key, can_view, can_edit, can_advance, can_delete, organization_id)
VALUES 
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'almox_ssm', true, false, false, false, '69aed6aa-5300-4e40-b66a-e71f3706db16'),
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'order_generation', true, false, false, false, '69aed6aa-5300-4e40-b66a-e71f3706db16'),
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'purchases', true, true, true, false, '69aed6aa-5300-4e40-b66a-e71f3706db16'),
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'almox_general', true, false, false, false, '69aed6aa-5300-4e40-b66a-e71f3706db16'),
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'production_client', true, false, false, false, '69aed6aa-5300-4e40-b66a-e71f3706db16'),
  ('fd83fbda-8160-47d2-bbe0-546938a8b160', 'production_stock', true, false, false, false, '69aed6aa-5300-4e40-b66a-e71f3706db16');