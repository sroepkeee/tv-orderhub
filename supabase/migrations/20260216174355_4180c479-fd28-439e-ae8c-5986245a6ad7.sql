
-- Correção 1: Permitir usuários autenticados lerem organizations
CREATE POLICY "Authenticated users can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);

-- Correção 2: Vincular 3 usuários órfãos à organização Imply
INSERT INTO organization_members (organization_id, user_id, role, is_active)
VALUES 
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', '75f07913-9f53-408f-b884-1cf57bffd724', 'member', true),
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', 'a87891a2-e16b-425c-a728-ac9e519f66b5', 'member', true),
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', 'f0a07056-c670-4929-924d-55a911f9d030', 'member', true)
ON CONFLICT DO NOTHING;
