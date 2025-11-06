-- Migration: Migrar usuários existentes para o sistema de permissões
-- Objetivo: Aprovar automaticamente usuários existentes e atribuir roles

-- ============================================
-- ETAPA 1: APROVAR USUÁRIOS EXISTENTES
-- ============================================

-- Criar registros de aprovação para todos os usuários existentes que não têm
INSERT INTO public.user_approval_status (user_id, status, approved_at, approved_by)
SELECT 
  p.id,
  'approved',
  now(),
  (SELECT id FROM public.profiles WHERE email = 'sroepke@imply.com' LIMIT 1)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_approval_status WHERE user_id = p.id
);

-- Ativar todos os perfis existentes
UPDATE public.profiles 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;

-- ============================================
-- ETAPA 2: ATRIBUIR ROLES DE ADMIN
-- ============================================

-- Atribuir role de admin para teste@imply.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'teste@imply.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Atribuir role de admin para sroepke@imply.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'sroepke@imply.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- ETAPA 3: ADICIONAR MAPEAMENTOS FALTANTES
-- ============================================

-- Garantir que o departamento "Suporte" está mapeado
INSERT INTO public.department_role_mapping (department, default_role) VALUES
  ('Suporte', 'admin')
ON CONFLICT (department) DO NOTHING;

-- ============================================
-- ETAPA 4: ATRIBUIR ROLES BASEADAS EM DEPARTAMENTO
-- ============================================

-- Atribuir roles para demais usuários baseado no departamento
INSERT INTO public.user_roles (user_id, role)
SELECT 
  p.id,
  drm.default_role
FROM public.profiles p
INNER JOIN public.department_role_mapping drm 
  ON p.department = drm.department
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = p.id
)
AND p.email NOT IN ('teste@imply.com', 'sroepke@imply.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- ETAPA 5: ATUALIZAR TRIGGER PARA PRIMEIRO USUÁRIO
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_assign_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default_role app_role;
  _is_first_user BOOLEAN;
BEGIN
  -- Verificar se é o primeiro usuário (torná-lo admin automaticamente)
  SELECT COUNT(*) = 0 INTO _is_first_user
  FROM public.profiles 
  WHERE id != NEW.id;
  
  IF _is_first_user THEN
    -- Primeiro usuário vira admin automaticamente e é aprovado
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.user_approval_status (user_id, status, approved_at)
    VALUES (NEW.id, 'approved', now())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Ativar perfil
    UPDATE public.profiles SET is_active = true WHERE id = NEW.id;
  ELSE
    -- Para demais usuários, seguir fluxo normal
    
    -- Buscar role padrão baseado no departamento
    SELECT default_role INTO _default_role
    FROM public.department_role_mapping
    WHERE department = NEW.department;
    
    -- Se encontrou mapeamento, atribuir role
    IF _default_role IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, _default_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    -- Criar registro de aprovação PENDENTE para novos usuários
    INSERT INTO public.user_approval_status (user_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- ETAPA 6: REGISTRAR NO AUDIT LOG
-- ============================================

INSERT INTO public.permission_audit_log (
  action_type,
  performed_by,
  details
)
SELECT 
  'user_approved',
  (SELECT id FROM public.profiles WHERE email = 'sroepke@imply.com' LIMIT 1),
  jsonb_build_object(
    'action', 'bulk_migration',
    'description', 'Auto-aprovação e atribuição de roles para usuários existentes durante implementação do sistema de permissões',
    'timestamp', now(),
    'total_users_approved', (SELECT COUNT(*) FROM public.user_approval_status WHERE status = 'approved'),
    'total_roles_assigned', (SELECT COUNT(*) FROM public.user_roles)
  );

-- ============================================
-- QUERY DE VALIDAÇÃO (para logs)
-- ============================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_approved_users INTEGER;
  v_users_with_roles INTEGER;
  v_admins INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_approved_users FROM public.user_approval_status WHERE status = 'approved';
  SELECT COUNT(DISTINCT user_id) INTO v_users_with_roles FROM public.user_roles;
  SELECT COUNT(DISTINCT user_id) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  
  RAISE NOTICE 'VALIDAÇÃO DA MIGRATION:';
  RAISE NOTICE '- Total de usuários: %', v_total_users;
  RAISE NOTICE '- Usuários aprovados: %', v_approved_users;
  RAISE NOTICE '- Usuários com roles: %', v_users_with_roles;
  RAISE NOTICE '- Administradores: %', v_admins;
END $$;