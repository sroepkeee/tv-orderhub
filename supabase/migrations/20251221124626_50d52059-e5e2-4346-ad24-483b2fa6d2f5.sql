-- =============================================
-- MIGRATION: Vincular dados existentes à organização Imply
-- Organização Imply ID: 69aed6aa-5300-4e40-b66a-e71f3706db16
-- Owner: sander.roepke@gmail.com (ID: 504d80e2-1283-41a0-add7-e6f5ae4849fc)
-- =============================================

-- 1. Vincular todos os pedidos à organização Imply
UPDATE orders 
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 2. Vincular todos os profiles à organização Imply
UPDATE profiles 
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 3. Vincular user_roles à organização Imply
UPDATE user_roles
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 4. Vincular fases legadas à organização Imply
UPDATE phase_config
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 5. Criar memberships para todos os usuários que ainda não são membros da Imply
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT 
  '69aed6aa-5300-4e40-b66a-e71f3706db16',
  id,
  'member',
  true
FROM profiles
WHERE id NOT IN (
  SELECT user_id FROM organization_members 
  WHERE organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
)
ON CONFLICT DO NOTHING;

-- 6. Definir sander.roepke@gmail.com como owner da organização
UPDATE organization_members
SET role = 'owner'
WHERE user_id = '504d80e2-1283-41a0-add7-e6f5ae4849fc'
  AND organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16';

-- 7. Vincular carriers à organização Imply
UPDATE carriers
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 8. Vincular customer_contacts à organização Imply
UPDATE customer_contacts
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 9. Vincular ai_agent_config à organização Imply
UPDATE ai_agent_config
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 10. Vincular ai_knowledge_base à organização Imply
UPDATE ai_knowledge_base
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 11. Vincular chart_configs à organização Imply
UPDATE chart_configs
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;

-- 12. Vincular ai_agent_instances à organização Imply
UPDATE ai_agent_instances
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16'
WHERE organization_id IS NULL;