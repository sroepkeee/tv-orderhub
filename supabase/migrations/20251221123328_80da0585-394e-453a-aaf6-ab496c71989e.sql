-- Corrigir a função create_organization_with_defaults removendo a coluna is_active
CREATE OR REPLACE FUNCTION public.create_organization_with_defaults(_org_name text, _slug text, _owner_user_id uuid, _plan text DEFAULT 'starter'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Criar fases padrão para a nova organização (sem is_active que não existe)
  INSERT INTO phase_config (organization_id, phase_key, display_name, order_index, responsible_role) VALUES
    (_org_id, 'entrada', 'Entrada', 1, 'almox_ssm'),
    (_org_id, 'processamento', 'Processamento', 2, 'production'),
    (_org_id, 'revisao', 'Revisão', 3, 'laboratory'),
    (_org_id, 'finalizacao', 'Finalização', 4, 'packaging'),
    (_org_id, 'entregue', 'Entregue', 5, 'logistics');
  
  -- Criar config de AI padrão
  INSERT INTO ai_agent_config (organization_id, agent_name, is_active)
  VALUES (_org_id, 'Assistente ' || _org_name, false);
  
  -- Dar role de admin ao owner
  INSERT INTO user_roles (user_id, role, organization_id)
  VALUES (_owner_user_id, 'admin', _org_id)
  ON CONFLICT (user_id, role) DO UPDATE SET organization_id = _org_id;
  
  RETURN _org_id;
END;
$function$;