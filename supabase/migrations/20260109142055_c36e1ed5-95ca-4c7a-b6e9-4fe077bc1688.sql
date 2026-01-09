-- Fix log_order_activity to handle NULL values properly
CREATE OR REPLACE FUNCTION public.log_order_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _description text := 'Ação não especificada';
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
    _description := 'Criou pedido ' || COALESCE(NEW.order_number, '(sem número)');
    _metadata := jsonb_build_object(
      'order_number', COALESCE(NEW.order_number, ''),
      'customer_name', COALESCE(NEW.customer_name, ''),
      'order_type', COALESCE(NEW.order_type, ''),
      'order_owner', NEW.user_id,
      'order_owner_name', COALESCE(_order_owner_name, 'Usuário')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou pedido ' || COALESCE(NEW.order_number, '(sem número)');
    _metadata := jsonb_build_object(
      'order_number', COALESCE(NEW.order_number, ''),
      'status_changed', CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN true ELSE false END,
      'old_status', COALESCE(OLD.status, ''),
      'new_status', COALESCE(NEW.status, ''),
      'order_owner', NEW.user_id,
      'order_owner_name', COALESCE(_order_owner_name, 'Usuário')
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Deletou pedido ' || COALESCE(OLD.order_number, '(sem número)');
    _metadata := jsonb_build_object(
      'order_number', COALESCE(OLD.order_number, ''),
      'order_owner', OLD.user_id,
      'order_owner_name', COALESCE(_order_owner_name, 'Usuário')
    );
  END IF;

  -- Só registrar se tiver descrição válida
  IF _description IS NOT NULL AND _action_type IS NOT NULL THEN
    PERFORM log_user_activity(
      auth.uid(),
      _action_type,
      'orders',
      COALESCE(NEW.id, OLD.id),
      _description,
      COALESCE(_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_order_item_activity to handle NULL values properly
CREATE OR REPLACE FUNCTION public.log_order_item_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _description text := 'Ação não especificada';
  _action_type text;
  _metadata jsonb;
  _order_number text;
BEGIN
  -- Buscar número do pedido
  SELECT order_number INTO _order_number FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  IF TG_OP = 'INSERT' THEN
    _action_type := 'insert';
    _description := 'Adicionou item ' || COALESCE(NEW.item_code, '(sem código)') || ' ao pedido ' || COALESCE(_order_number, '(desconhecido)');
    _metadata := jsonb_build_object(
      'item_code', COALESCE(NEW.item_code, ''),
      'item_description', COALESCE(NEW.item_description, ''),
      'quantity', COALESCE(NEW.requested_quantity, 0),
      'order_number', COALESCE(_order_number, '')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action_type := 'update';
    _description := 'Atualizou item ' || COALESCE(NEW.item_code, '(sem código)') || ' do pedido ' || COALESCE(_order_number, '(desconhecido)');
    _metadata := jsonb_build_object(
      'item_code', COALESCE(NEW.item_code, ''),
      'order_number', COALESCE(_order_number, ''),
      'changes', jsonb_build_object(
        'quantity_changed', CASE WHEN OLD.requested_quantity IS DISTINCT FROM NEW.requested_quantity THEN true ELSE false END,
        'status_changed', CASE WHEN OLD.item_status IS DISTINCT FROM NEW.item_status THEN true ELSE false END
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action_type := 'delete';
    _description := 'Removeu item ' || COALESCE(OLD.item_code, '(sem código)') || ' do pedido ' || COALESCE(_order_number, '(desconhecido)');
    _metadata := jsonb_build_object(
      'item_code', COALESCE(OLD.item_code, ''),
      'order_number', COALESCE(_order_number, '')
    );
  END IF;

  -- Só registrar se tiver descrição válida
  IF _description IS NOT NULL AND _action_type IS NOT NULL THEN
    PERFORM log_user_activity(
      auth.uid(),
      _action_type,
      'order_items',
      COALESCE(NEW.id, OLD.id),
      _description,
      COALESCE(_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_comment_activity to handle NULL values properly
CREATE OR REPLACE FUNCTION public.log_comment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order_number text;
  _description text := 'Ação não especificada';
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar número do pedido
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    _description := 'Adicionou comentário no pedido ' || COALESCE(_order_number, '(desconhecido)');
    
    PERFORM log_user_activity(
      auth.uid(),
      'insert',
      'order_comments',
      NEW.id,
      _description,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', COALESCE(_order_number, ''),
        'comment_preview', COALESCE(LEFT(NEW.comment, 100), '')
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    _description := 'Editou comentário no pedido ' || COALESCE(_order_number, '(desconhecido)');
    
    PERFORM log_user_activity(
      auth.uid(),
      'update',
      'order_comments',
      NEW.id,
      _description,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', COALESCE(_order_number, '')
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = OLD.order_id;
    _description := 'Deletou comentário no pedido ' || COALESCE(_order_number, '(desconhecido)');
    
    PERFORM log_user_activity(
      auth.uid(),
      'delete',
      'order_comments',
      OLD.id,
      _description,
      jsonb_build_object(
        'order_id', OLD.order_id,
        'order_number', COALESCE(_order_number, '')
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix log_attachment_activity to handle NULL values properly
CREATE OR REPLACE FUNCTION public.log_attachment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order_number text;
  _description text := 'Ação não especificada';
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar número do pedido
    SELECT order_number INTO _order_number FROM orders WHERE id = NEW.order_id;
    _description := 'Fez upload de arquivo: ' || COALESCE(NEW.file_name, 'arquivo') || ' no pedido ' || COALESCE(_order_number, '(desconhecido)');
    
    PERFORM log_user_activity(
      auth.uid(),
      'insert',
      'order_attachments',
      NEW.id,
      _description,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'order_number', COALESCE(_order_number, ''),
        'file_name', COALESCE(NEW.file_name, ''),
        'file_type', COALESCE(NEW.file_type, ''),
        'file_size', COALESCE(NEW.file_size, 0)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT order_number INTO _order_number FROM orders WHERE id = OLD.order_id;
    _description := 'Deletou arquivo: ' || COALESCE(OLD.file_name, 'arquivo') || ' do pedido ' || COALESCE(_order_number, '(desconhecido)');
    
    PERFORM log_user_activity(
      auth.uid(),
      'delete',
      'order_attachments',
      OLD.id,
      _description,
      jsonb_build_object(
        'order_id', OLD.order_id,
        'order_number', COALESCE(_order_number, ''),
        'file_name', COALESCE(OLD.file_name, '')
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;