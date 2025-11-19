-- =====================================================
-- PARTE 1: Corrigir triggers existentes para usar auth.uid()
-- =====================================================

-- 1.1 Corrigir log_order_activity()
CREATE OR REPLACE FUNCTION public.log_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _description text;
  _action_type text;
  _metadata jsonb;
  _order_owner_name text;
BEGIN
  -- Buscar nome do dono do pedido
  SELECT full_name INTO _order_owner_name 
  FROM profiles 
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    _action_type := 'insert';
    _description := 'Criou pedido ' || NEW.order_number;
    _metadata := jsonb_build_object(
      'order_number', NEW.order_number,
      'customer_name', NEW.customer_name,
      'order_type', NEW.order_type,
      'order_owner', NEW.user_id,
      'order_owner_name', _order_owner_name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou pedido ' || NEW.order_number;
    _metadata := jsonb_build_object(
      'order_number', NEW.order_number,
      'status_changed', CASE WHEN OLD.status <> NEW.status THEN true ELSE false END,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'order_owner', NEW.user_id,
      'order_owner_name', _order_owner_name
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Deletou pedido ' || OLD.order_number;
    _metadata := jsonb_build_object(
      'order_number', OLD.order_number,
      'order_owner', OLD.user_id,
      'order_owner_name', _order_owner_name
    );
  END IF;

  -- CORREÇÃO CRÍTICA: Usar auth.uid() ao invés do user_id do pedido
  PERFORM log_user_activity(
    auth.uid(),  -- ✅ Usuário que executa a ação
    _action_type,
    'orders',
    COALESCE(NEW.id, OLD.id),
    _description,
    _metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 1.2 Corrigir log_order_item_activity()
CREATE OR REPLACE FUNCTION public.log_order_item_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      'quantity', NEW.requested_quantity,
      'order_number', _order_number
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou item ' || NEW.item_code || ' do pedido ' || _order_number;
    _metadata := jsonb_build_object(
      'item_code', NEW.item_code,
      'order_number', _order_number,
      'changes', jsonb_build_object(
        'quantity_changed', CASE WHEN OLD.requested_quantity <> NEW.requested_quantity THEN true ELSE false END,
        'status_changed', CASE WHEN OLD.item_status <> NEW.item_status THEN true ELSE false END
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Removeu item ' || OLD.item_code || ' do pedido ' || _order_number;
    _metadata := jsonb_build_object(
      'item_code', OLD.item_code,
      'order_number', _order_number
    );
  END IF;

  -- CORREÇÃO CRÍTICA: Usar auth.uid()
  PERFORM log_user_activity(
    auth.uid(),
    _action_type,
    'order_items',
    COALESCE(NEW.id, OLD.id),
    _description,
    _metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =====================================================
-- PARTE 2: Criar triggers para order_comments
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_comment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_number text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar número do pedido
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    
    PERFORM log_user_activity(
      auth.uid(),
      'insert',
      'order_comments',
      NEW.id,
      'Adicionou comentário no pedido ' || _order_number,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', _order_number,
        'comment_preview', LEFT(NEW.comment, 100)
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    
    PERFORM log_user_activity(
      auth.uid(),
      'update',
      'order_comments',
      NEW.id,
      'Editou comentário no pedido ' || _order_number,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', _order_number
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = OLD.order_id;
    
    PERFORM log_user_activity(
      auth.uid(),
      'delete',
      'order_comments',
      OLD.id,
      'Deletou comentário no pedido ' || _order_number,
      jsonb_build_object(
        'order_id', OLD.order_id,
        'order_number', _order_number
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER order_comments_activity_log
AFTER INSERT OR UPDATE OR DELETE ON order_comments
FOR EACH ROW
EXECUTE FUNCTION log_comment_activity();

-- =====================================================
-- PARTE 3: Criar triggers para order_attachments
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_attachment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_number text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar número do pedido
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    
    PERFORM log_user_activity(
      auth.uid(),
      'insert',
      'order_attachments',
      NEW.id,
      'Fez upload de arquivo: ' || NEW.file_name || ' no pedido ' || _order_number,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', _order_number,
        'file_name', NEW.file_name,
        'file_type', NEW.file_type,
        'file_size', NEW.file_size
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = OLD.order_id;
    
    PERFORM log_user_activity(
      auth.uid(),
      'delete',
      'order_attachments',
      OLD.id,
      'Deletou arquivo: ' || OLD.file_name || ' do pedido ' || _order_number,
      jsonb_build_object(
        'order_id', OLD.order_id,
        'order_number', _order_number,
        'file_name', OLD.file_name
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER order_attachments_activity_log
AFTER INSERT OR DELETE ON order_attachments
FOR EACH ROW
EXECUTE FUNCTION log_attachment_activity();

-- =====================================================
-- PARTE 4: Adicionar índices para performance
-- =====================================================

-- Índice composto para consultas filtradas e ordenadas
CREATE INDEX IF NOT EXISTS idx_user_activity_action_table 
ON user_activity_log(user_id, action_type, table_name, created_at DESC);

-- Índice para busca por tipo de ação
CREATE INDEX IF NOT EXISTS idx_user_activity_action_type 
ON user_activity_log(action_type, created_at DESC);

-- Índice para busca por tabela
CREATE INDEX IF NOT EXISTS idx_user_activity_table_name 
ON user_activity_log(table_name, created_at DESC);

-- =====================================================
-- PARTE 5: Função helper para mapear status -> phase
-- =====================================================

-- Esta função já existe, mas vamos garantir que está correta
-- (já foi criada na migração anterior, não precisa recriar)