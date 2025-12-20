-- =====================================================
-- MULTI-TENANCY FASE 2: Adicionar organization_id nas tabelas core
-- =====================================================

-- 2.1 Adicionar organization_id em PROFILES
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- 2.2 Adicionar organization_id em ORDERS
ALTER TABLE orders ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_orders_org ON orders(organization_id);

-- 2.3 Adicionar organization_id em PHASE_CONFIG
ALTER TABLE phase_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_phase_config_org ON phase_config(organization_id);

-- 2.4 Adicionar organization_id em PHASE_PERMISSIONS
ALTER TABLE phase_permissions ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_phase_permissions_org ON phase_permissions(organization_id);

-- 2.5 Adicionar organization_id em CARRIERS
ALTER TABLE carriers ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_carriers_org ON carriers(organization_id);

-- 2.6 Adicionar organization_id em CUSTOMER_CONTACTS
ALTER TABLE customer_contacts ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_customer_contacts_org ON customer_contacts(organization_id);

-- 2.7 Adicionar organization_id em WHATSAPP_INSTANCES
ALTER TABLE whatsapp_instances ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_whatsapp_instances_org ON whatsapp_instances(organization_id);

-- 2.8 Adicionar organization_id em AI_AGENT_CONFIG
ALTER TABLE ai_agent_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_ai_agent_config_org ON ai_agent_config(organization_id);

-- 2.9 Adicionar organization_id em AI_AGENT_INSTANCES
ALTER TABLE ai_agent_instances ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_ai_agent_instances_org ON ai_agent_instances(organization_id);

-- 2.10 Adicionar organization_id em AI_KNOWLEDGE_BASE
ALTER TABLE ai_knowledge_base ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_ai_knowledge_base_org ON ai_knowledge_base(organization_id);

-- 2.11 Adicionar organization_id em ORDER_TYPE_CONFIG
ALTER TABLE order_type_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_order_type_config_org ON order_type_config(organization_id);

-- 2.12 Adicionar organization_id em PURCHASE_REQUESTS
ALTER TABLE purchase_requests ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_purchase_requests_org ON purchase_requests(organization_id);

-- 2.13 Adicionar organization_id em USER_ROLES (para permissões por tenant)
ALTER TABLE user_roles ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);

-- 2.14 Adicionar organization_id em NOTIFICATIONS
ALTER TABLE notifications ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_notifications_org ON notifications(organization_id);

-- 2.15 Atualizar função create_organization_with_defaults para popular fases
CREATE OR REPLACE FUNCTION public.create_organization_with_defaults(
  _org_name TEXT,
  _slug TEXT,
  _owner_user_id UUID,
  _plan TEXT DEFAULT 'starter'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
BEGIN
  -- Criar organização
  INSERT INTO organizations (name, slug, plan)
  VALUES (_org_name, _slug, _plan)
  RETURNING id INTO _org_id;
  
  -- Vincular owner como primeiro membro
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (_org_id, _owner_user_id, 'owner');
  
  -- Atualizar profile do owner com organization_id
  UPDATE profiles SET organization_id = _org_id WHERE id = _owner_user_id;
  
  -- Criar fases padrão para a nova organização
  INSERT INTO phase_config (organization_id, phase_key, display_name, order_index, responsible_role, is_active) VALUES
    (_org_id, 'entrada', 'Entrada', 1, 'almox_ssm', true),
    (_org_id, 'processamento', 'Processamento', 2, 'production', true),
    (_org_id, 'revisao', 'Revisão', 3, 'laboratory', true),
    (_org_id, 'finalizacao', 'Finalização', 4, 'packaging', true),
    (_org_id, 'entregue', 'Entregue', 5, 'logistics', true);
  
  -- Criar config de AI padrão
  INSERT INTO ai_agent_config (organization_id, agent_name, is_active)
  VALUES (_org_id, 'Assistente ' || _org_name, false);
  
  -- Dar role de admin ao owner
  INSERT INTO user_roles (user_id, role, organization_id)
  VALUES (_owner_user_id, 'admin', _org_id)
  ON CONFLICT (user_id, role) DO UPDATE SET organization_id = _org_id;
  
  RETURN _org_id;
END;
$$;