-- =====================================================
-- MULTI-TENANCY FASE 3: Atualizar RLS Policies para Multi-tenant
-- =====================================================

-- 3.1 ORDERS - Atualizar policies para filtrar por organization_id
DROP POLICY IF EXISTS "Users can view orders in their phases" ON orders;
DROP POLICY IF EXISTS "Users with phase access can update orders" ON orders;
DROP POLICY IF EXISTS "Users can insert orders" ON orders;
DROP POLICY IF EXISTS "Users can delete orders from their phases" ON orders;

CREATE POLICY "Org users can view orders"
  ON orders FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      has_role(auth.uid(), 'admin') 
      OR auth.uid() = user_id
      OR can_view_phase(auth.uid(), get_phase_from_order(id))
    )
  );

CREATE POLICY "Org users can insert orders"
  ON orders FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Org users can update orders"
  ON orders FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND (
      has_role(auth.uid(), 'admin')
      OR auth.uid() = user_id
      OR can_edit_phase(auth.uid(), get_phase_from_order(id))
    )
  );

CREATE POLICY "Org admins can delete orders"
  ON orders FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND has_role(auth.uid(), 'admin')
  );

-- 3.2 PROFILES - Atualizar policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Org users can view profiles in their org"
  ON profiles FOR SELECT
  USING (
    organization_id IS NULL -- Usuários sem org ainda podem ver próprio perfil
    OR organization_id = get_user_organization_id()
    OR id = auth.uid()
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3.3 CARRIERS - Atualizar policies
DROP POLICY IF EXISTS "Authenticated users can view carriers" ON carriers;
DROP POLICY IF EXISTS "Authenticated users can create carriers" ON carriers;
DROP POLICY IF EXISTS "Authenticated users can update carriers" ON carriers;
DROP POLICY IF EXISTS "Authenticated users can delete carriers" ON carriers;

CREATE POLICY "Org users can view carriers"
  ON carriers FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create carriers"
  ON carriers FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org users can update carriers"
  ON carriers FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete carriers"
  ON carriers FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.4 CUSTOMER_CONTACTS - Atualizar policies
DROP POLICY IF EXISTS "Authenticated users can view customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Authenticated users can update customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Admins can delete customer contacts" ON customer_contacts;

CREATE POLICY "Org users can view customer contacts"
  ON customer_contacts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create customer contacts"
  ON customer_contacts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org users can update customer contacts"
  ON customer_contacts FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can delete customer contacts"
  ON customer_contacts FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.5 PHASE_CONFIG - Policies por org
DROP POLICY IF EXISTS "Authenticated users can view phase config" ON phase_config;
DROP POLICY IF EXISTS "Admins can manage phase config" ON phase_config;

CREATE POLICY "Org users can view phase config"
  ON phase_config FOR SELECT
  USING (
    organization_id IS NULL -- Global phases
    OR organization_id = get_user_organization_id()
  );

CREATE POLICY "Org admins can manage phase config"
  ON phase_config FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.6 PHASE_PERMISSIONS - Policies por org
DROP POLICY IF EXISTS "Authenticated users can view phase permissions" ON phase_permissions;
DROP POLICY IF EXISTS "Admins can manage phase permissions" ON phase_permissions;

CREATE POLICY "Org users can view phase permissions"
  ON phase_permissions FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = get_user_organization_id()
  );

CREATE POLICY "Org admins can manage phase permissions"
  ON phase_permissions FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.7 NOTIFICATIONS - Policies por org
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- 3.8 AI_AGENT_CONFIG - Policies por org (mantém super admin também)
-- Manter policies existentes de super admin, mas adicionar org-level

CREATE POLICY "Org admins can view their AI config"
  ON ai_agent_config FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    OR is_ai_agent_admin(auth.uid())
  );

CREATE POLICY "Org admins can manage their AI config"
  ON ai_agent_config FOR ALL
  USING (
    (organization_id = get_user_organization_id() AND is_org_admin())
    OR is_ai_agent_admin(auth.uid())
  );

-- 3.9 WHATSAPP_INSTANCES - Policies por org
DROP POLICY IF EXISTS "Authenticated users can view instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Authenticated users can insert instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Authenticated users can update instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Authenticated users can delete instances" ON whatsapp_instances;

CREATE POLICY "Org users can view whatsapp instances"
  ON whatsapp_instances FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can manage whatsapp instances"
  ON whatsapp_instances FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.10 ORDER_TYPE_CONFIG - Policies por org
DROP POLICY IF EXISTS "Authenticated users can view order types" ON order_type_config;
DROP POLICY IF EXISTS "Admins can manage order types" ON order_type_config;

CREATE POLICY "Org users can view order types"
  ON order_type_config FOR SELECT
  USING (
    organization_id IS NULL -- Global types
    OR organization_id = get_user_organization_id()
  );

CREATE POLICY "Org admins can manage order types"
  ON order_type_config FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_org_admin()
  );

-- 3.11 PURCHASE_REQUESTS - Policies por org
DROP POLICY IF EXISTS "Authenticated users can view purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Authenticated users can create purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Authenticated users can update purchase requests" ON purchase_requests;

CREATE POLICY "Org users can view purchase requests"
  ON purchase_requests FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Org users can create purchase requests"
  ON purchase_requests FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Org users can update purchase requests"
  ON purchase_requests FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- 3.12 USER_ROLES - Atualizar para multi-tenant
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

CREATE POLICY "Org users can view roles in their org"
  ON user_roles FOR SELECT
  USING (
    organization_id IS NULL -- Legacy roles
    OR organization_id = get_user_organization_id()
    OR user_id = auth.uid()
  );

CREATE POLICY "Org admins can manage roles"
  ON user_roles FOR ALL
  USING (
    (organization_id IS NULL AND has_role(auth.uid(), 'admin'))
    OR (organization_id = get_user_organization_id() AND is_org_admin())
  );