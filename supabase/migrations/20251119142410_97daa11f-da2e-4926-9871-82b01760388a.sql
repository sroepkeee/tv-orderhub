-- =============================================
-- PARTE 1: Criar tabela de log de atividades
-- =============================================

-- Criar tabela de log de atividades
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  table_name text,
  record_id uuid,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON public.user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_table_name ON public.user_activity_log(table_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action_type ON public.user_activity_log(action_type);

-- Comentários para documentação
COMMENT ON TABLE public.user_activity_log IS 'Log centralizado de todas as atividades dos usuários';
COMMENT ON COLUMN public.user_activity_log.action_type IS 'Tipo de ação: insert, update, delete, login, logout, approve, reject, etc.';
COMMENT ON COLUMN public.user_activity_log.metadata IS 'Dados adicionais em JSON: old_value, new_value, fields_changed, etc.';

-- =============================================
-- PARTE 2: RLS Policies
-- =============================================

-- Habilitar RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os logs
CREATE POLICY "Admins can view all activity logs"
ON public.user_activity_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Sistema pode inserir logs
CREATE POLICY "System can insert activity logs"
ON public.user_activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins podem deletar logs antigos (opcional)
CREATE POLICY "Admins can delete old logs"
ON public.user_activity_log
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- PARTE 3: Função helper para logging
-- =============================================

CREATE OR REPLACE FUNCTION public.log_user_activity(
  _user_id uuid,
  _action_type text,
  _table_name text,
  _record_id uuid,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (
    user_id,
    action_type,
    table_name,
    record_id,
    description,
    metadata
  ) VALUES (
    _user_id,
    _action_type,
    _table_name,
    _record_id,
    _description,
    _metadata
  );
END;
$$;

-- =============================================
-- PARTE 4: Triggers para tabelas principais
-- =============================================

-- Trigger para logs de pedidos
CREATE OR REPLACE FUNCTION public.log_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text;
  _action_type text;
  _metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action_type := 'insert';
    _description := 'Criou pedido ' || NEW.order_number;
    _metadata := jsonb_build_object(
      'order_number', NEW.order_number,
      'customer_name', NEW.customer_name,
      'order_type', NEW.order_type
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou pedido ' || NEW.order_number;
    _metadata := jsonb_build_object(
      'order_number', NEW.order_number,
      'status_changed', CASE WHEN OLD.status <> NEW.status THEN true ELSE false END,
      'old_status', OLD.status,
      'new_status', NEW.status
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Deletou pedido ' || OLD.order_number;
    _metadata := jsonb_build_object(
      'order_number', OLD.order_number
    );
  END IF;

  PERFORM log_user_activity(
    COALESCE(NEW.user_id, OLD.user_id),
    _action_type,
    'orders',
    COALESCE(NEW.id, OLD.id),
    _description,
    _metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger em orders
DROP TRIGGER IF EXISTS orders_activity_log ON public.orders;
CREATE TRIGGER orders_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION log_order_activity();

-- Trigger para logs de itens de pedido
CREATE OR REPLACE FUNCTION public.log_order_item_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text;
  _action_type text;
  _metadata jsonb;
  _order_number text;
BEGIN
  -- Buscar número do pedido
  SELECT order_number INTO _order_number FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  IF TG_OP = 'INSERT' THEN
    _action_type := 'insert';
    _description := 'Adicionou item ' || NEW.item_code || ' ao pedido ' || _order_number;
    _metadata := jsonb_build_object(
      'item_code', NEW.item_code,
      'item_description', NEW.item_description,
      'quantity', NEW.requested_quantity
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou item ' || NEW.item_code || ' do pedido ' || _order_number;
    _metadata := jsonb_build_object(
      'item_code', NEW.item_code,
      'changes', jsonb_build_object(
        'quantity_changed', CASE WHEN OLD.requested_quantity <> NEW.requested_quantity THEN true ELSE false END,
        'status_changed', CASE WHEN OLD.item_status <> NEW.item_status THEN true ELSE false END
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Removeu item ' || OLD.item_code || ' do pedido ' || _order_number;
    _metadata := jsonb_build_object(
      'item_code', OLD.item_code
    );
  END IF;

  PERFORM log_user_activity(
    COALESCE(NEW.user_id, OLD.user_id),
    _action_type,
    'order_items',
    COALESCE(NEW.id, OLD.id),
    _description,
    _metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger em order_items
DROP TRIGGER IF EXISTS order_items_activity_log ON public.order_items;
CREATE TRIGGER order_items_activity_log
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION log_order_item_activity();

-- Trigger para logs de roles
CREATE OR REPLACE FUNCTION public.log_user_role_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text;
  _action_type text;
  _metadata jsonb;
  _user_name text;
BEGIN
  -- Buscar nome do usuário
  SELECT full_name INTO _user_name FROM profiles WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    _action_type := 'insert';
    _description := 'Concedeu role "' || NEW.role || '" para ' || COALESCE(_user_name, 'usuário');
    _metadata := jsonb_build_object(
      'role', NEW.role,
      'user_name', _user_name
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Removeu role "' || OLD.role || '" de ' || COALESCE(_user_name, 'usuário');
    _metadata := jsonb_build_object(
      'role', OLD.role,
      'user_name', _user_name
    );
  END IF;

  PERFORM log_user_activity(
    auth.uid(),
    _action_type,
    'user_roles',
    COALESCE(NEW.user_id, OLD.user_id),
    _description,
    _metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger em user_roles
DROP TRIGGER IF EXISTS user_roles_activity_log ON public.user_roles;
CREATE TRIGGER user_roles_activity_log
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION log_user_role_activity();

-- Trigger para logs de aprovação de usuários
CREATE OR REPLACE FUNCTION public.log_user_approval_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text;
  _action_type text;
  _metadata jsonb;
  _user_name text;
BEGIN
  -- Buscar nome do usuário
  SELECT full_name INTO _user_name FROM profiles WHERE id = NEW.user_id;

  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status = 'approved' THEN
      _action_type := 'approve';
      _description := 'Aprovou usuário ' || COALESCE(_user_name, 'sem nome');
    ELSIF NEW.status = 'rejected' THEN
      _action_type := 'reject';
      _description := 'Rejeitou usuário ' || COALESCE(_user_name, 'sem nome');
    ELSE
      _action_type := 'update';
      _description := 'Atualizou status de aprovação de ' || COALESCE(_user_name, 'sem nome');
    END IF;

    _metadata := jsonb_build_object(
      'user_name', _user_name,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'rejection_reason', NEW.rejection_reason
    );

    PERFORM log_user_activity(
      NEW.approved_by,
      _action_type,
      'user_approval_status',
      NEW.user_id,
      _description,
      _metadata
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Aplicar trigger em user_approval_status
DROP TRIGGER IF EXISTS user_approval_activity_log ON public.user_approval_status;
CREATE TRIGGER user_approval_activity_log
AFTER UPDATE ON public.user_approval_status
FOR EACH ROW
EXECUTE FUNCTION log_user_approval_activity();