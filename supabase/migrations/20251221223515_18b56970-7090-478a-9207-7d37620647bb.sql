
-- =====================================================
-- SPRINT 1: ISOLAMENTO DE TABELAS DE ORDERS
-- =====================================================

-- 1. FUNÇÃO HELPER: Verificar acesso a pedido pela organização
CREATE OR REPLACE FUNCTION public.can_access_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = _order_id
      AND o.organization_id = get_user_organization_id()
  );
$$;

-- 2. FUNÇÃO HELPER: Obter organization_id de um pedido
CREATE OR REPLACE FUNCTION public.get_order_organization_id(_order_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM orders WHERE id = _order_id;
$$;

-- =====================================================
-- 3. ADICIONAR COLUNAS organization_id
-- =====================================================

-- order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_comments
ALTER TABLE public.order_comments 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_changes
ALTER TABLE public.order_changes 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_attachments
ALTER TABLE public.order_attachments 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_volumes
ALTER TABLE public.order_volumes 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_occurrences
ALTER TABLE public.order_occurrences 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_history
ALTER TABLE public.order_history 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_item_history
ALTER TABLE public.order_item_history 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- delivery_date_changes
ALTER TABLE public.delivery_date_changes 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- order_completion_notes
ALTER TABLE public.order_completion_notes 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- lab_item_work
ALTER TABLE public.lab_item_work 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- mention_tags
ALTER TABLE public.mention_tags 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- =====================================================
-- 4. POPULAR DADOS EXISTENTES (herdar de orders)
-- =====================================================

UPDATE public.order_items oi
SET organization_id = o.organization_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.organization_id IS NULL;

UPDATE public.order_comments oc
SET organization_id = o.organization_id
FROM public.orders o
WHERE oc.order_id = o.id AND oc.organization_id IS NULL;

UPDATE public.order_changes oc
SET organization_id = o.organization_id
FROM public.orders o
WHERE oc.order_id = o.id AND oc.organization_id IS NULL;

UPDATE public.order_attachments oa
SET organization_id = o.organization_id
FROM public.orders o
WHERE oa.order_id = o.id AND oa.organization_id IS NULL;

UPDATE public.order_volumes ov
SET organization_id = o.organization_id
FROM public.orders o
WHERE ov.order_id = o.id AND ov.organization_id IS NULL;

UPDATE public.order_occurrences oo
SET organization_id = o.organization_id
FROM public.orders o
WHERE oo.order_id = o.id AND oo.organization_id IS NULL;

UPDATE public.order_history oh
SET organization_id = o.organization_id
FROM public.orders o
WHERE oh.order_id = o.id AND oh.organization_id IS NULL;

UPDATE public.order_item_history oih
SET organization_id = o.organization_id
FROM public.order_items oi
JOIN public.orders o ON oi.order_id = o.id
WHERE oih.order_item_id = oi.id AND oih.organization_id IS NULL;

UPDATE public.delivery_date_changes ddc
SET organization_id = o.organization_id
FROM public.orders o
WHERE ddc.order_id = o.id AND ddc.organization_id IS NULL;

UPDATE public.order_completion_notes ocn
SET organization_id = o.organization_id
FROM public.orders o
WHERE ocn.order_id = o.id AND ocn.organization_id IS NULL;

UPDATE public.lab_item_work liw
SET organization_id = o.organization_id
FROM public.orders o
WHERE liw.order_id = o.id AND liw.organization_id IS NULL;

UPDATE public.mention_tags mt
SET organization_id = o.organization_id
FROM public.orders o
WHERE mt.order_id = o.id AND mt.organization_id IS NULL;

-- =====================================================
-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_order_items_org ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_org ON order_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_changes_org ON order_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_org ON order_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_volumes_org ON order_volumes(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_occurrences_org ON order_occurrences(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_history_org ON order_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_item_history_org ON order_item_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_date_changes_org ON delivery_date_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_completion_notes_org ON order_completion_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_item_work_org ON lab_item_work(organization_id);
CREATE INDEX IF NOT EXISTS idx_mention_tags_org ON mention_tags(organization_id);

-- =====================================================
-- 6. TRIGGER: Propagar organization_id automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION public.propagate_order_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se organization_id não foi definido, herdar do pedido
  IF NEW.organization_id IS NULL AND NEW.order_id IS NOT NULL THEN
    NEW.organization_id := get_order_organization_id(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers para cada tabela
DROP TRIGGER IF EXISTS propagate_org_order_items ON order_items;
CREATE TRIGGER propagate_org_order_items
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_comments ON order_comments;
CREATE TRIGGER propagate_org_order_comments
  BEFORE INSERT ON order_comments
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_changes ON order_changes;
CREATE TRIGGER propagate_org_order_changes
  BEFORE INSERT ON order_changes
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_attachments ON order_attachments;
CREATE TRIGGER propagate_org_order_attachments
  BEFORE INSERT ON order_attachments
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_volumes ON order_volumes;
CREATE TRIGGER propagate_org_order_volumes
  BEFORE INSERT ON order_volumes
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_occurrences ON order_occurrences;
CREATE TRIGGER propagate_org_order_occurrences
  BEFORE INSERT ON order_occurrences
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_history ON order_history;
CREATE TRIGGER propagate_org_order_history
  BEFORE INSERT ON order_history
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_delivery_date_changes ON delivery_date_changes;
CREATE TRIGGER propagate_org_delivery_date_changes
  BEFORE INSERT ON delivery_date_changes
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_order_completion_notes ON order_completion_notes;
CREATE TRIGGER propagate_org_order_completion_notes
  BEFORE INSERT ON order_completion_notes
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_lab_item_work ON lab_item_work;
CREATE TRIGGER propagate_org_lab_item_work
  BEFORE INSERT ON lab_item_work
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

DROP TRIGGER IF EXISTS propagate_org_mention_tags ON mention_tags;
CREATE TRIGGER propagate_org_mention_tags
  BEFORE INSERT ON mention_tags
  FOR EACH ROW EXECUTE FUNCTION propagate_order_organization_id();

-- Trigger especial para order_item_history (herda via order_item)
CREATE OR REPLACE FUNCTION public.propagate_order_item_history_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.order_item_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM order_items WHERE id = NEW.order_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_org_order_item_history ON order_item_history;
CREATE TRIGGER propagate_org_order_item_history
  BEFORE INSERT ON order_item_history
  FOR EACH ROW EXECUTE FUNCTION propagate_order_item_history_org();

-- =====================================================
-- 7. ATUALIZAR RLS POLICIES - ORDER_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view order items" ON order_items;
CREATE POLICY "Org users can view order items"
ON order_items FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Authenticated users can create order items" ON order_items;
CREATE POLICY "Org users can create order items"
ON order_items FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Authenticated users can update order items" ON order_items;
CREATE POLICY "Org users can update order items"
ON order_items FOR UPDATE
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Authenticated users can delete order items" ON order_items;
CREATE POLICY "Org users can delete order items"
ON order_items FOR DELETE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 8. ATUALIZAR RLS POLICIES - ORDER_COMMENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view comments on their orders" ON order_comments;
DROP POLICY IF EXISTS "Authenticated users can view comments" ON order_comments;
CREATE POLICY "Org users can view order comments"
ON order_comments FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create comments" ON order_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON order_comments;
CREATE POLICY "Org users can create order comments"
ON order_comments FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can update their own comments" ON order_comments;
DROP POLICY IF EXISTS "Authenticated users can update comments" ON order_comments;
CREATE POLICY "Org users can update order comments"
ON order_comments FOR UPDATE
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete their own comments" ON order_comments;
DROP POLICY IF EXISTS "Authenticated users can delete comments" ON order_comments;
CREATE POLICY "Org users can delete order comments"
ON order_comments FOR DELETE
USING (organization_id = get_user_organization_id() AND user_id = auth.uid());

-- =====================================================
-- 9. ATUALIZAR RLS POLICIES - ORDER_CHANGES
-- =====================================================

DROP POLICY IF EXISTS "Users can view order changes" ON order_changes;
DROP POLICY IF EXISTS "Authenticated users can view order changes" ON order_changes;
CREATE POLICY "Org users can view order changes"
ON order_changes FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create order changes" ON order_changes;
DROP POLICY IF EXISTS "Authenticated users can create order changes" ON order_changes;
CREATE POLICY "Org users can create order changes"
ON order_changes FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- =====================================================
-- 10. ATUALIZAR RLS POLICIES - ORDER_ATTACHMENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view their order attachments" ON order_attachments;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON order_attachments;
CREATE POLICY "Org users can view order attachments"
ON order_attachments FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can upload to their orders" ON order_attachments;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON order_attachments;
CREATE POLICY "Org users can create order attachments"
ON order_attachments FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can delete their order attachments" ON order_attachments;
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON order_attachments;
CREATE POLICY "Org users can delete order attachments"
ON order_attachments FOR DELETE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 11. ATUALIZAR RLS POLICIES - ORDER_VOLUMES
-- =====================================================

DROP POLICY IF EXISTS "Users can view order volumes" ON order_volumes;
DROP POLICY IF EXISTS "Authenticated users can view volumes" ON order_volumes;
CREATE POLICY "Org users can view order volumes"
ON order_volumes FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create order volumes" ON order_volumes;
DROP POLICY IF EXISTS "Authenticated users can create volumes" ON order_volumes;
CREATE POLICY "Org users can create order volumes"
ON order_volumes FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can update order volumes" ON order_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volumes" ON order_volumes;
CREATE POLICY "Org users can update order volumes"
ON order_volumes FOR UPDATE
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete order volumes" ON order_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volumes" ON order_volumes;
CREATE POLICY "Org users can delete order volumes"
ON order_volumes FOR DELETE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 12. ATUALIZAR RLS POLICIES - ORDER_OCCURRENCES
-- =====================================================

DROP POLICY IF EXISTS "Users can view order occurrences" ON order_occurrences;
DROP POLICY IF EXISTS "Authenticated users can view occurrences" ON order_occurrences;
CREATE POLICY "Org users can view order occurrences"
ON order_occurrences FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create order occurrences" ON order_occurrences;
DROP POLICY IF EXISTS "Authenticated users can create occurrences" ON order_occurrences;
CREATE POLICY "Org users can create order occurrences"
ON order_occurrences FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can update order occurrences" ON order_occurrences;
DROP POLICY IF EXISTS "Authenticated users can update occurrences" ON order_occurrences;
CREATE POLICY "Org users can update order occurrences"
ON order_occurrences FOR UPDATE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 13. ATUALIZAR RLS POLICIES - ORDER_HISTORY
-- =====================================================

DROP POLICY IF EXISTS "Users can view order history" ON order_history;
DROP POLICY IF EXISTS "Authenticated users can view history" ON order_history;
CREATE POLICY "Org users can view order history"
ON order_history FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can create order history" ON order_history;
DROP POLICY IF EXISTS "Authenticated users can create history" ON order_history;
CREATE POLICY "Org users can create order history"
ON order_history FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- =====================================================
-- 14. ATUALIZAR RLS POLICIES - ORDER_ITEM_HISTORY
-- =====================================================

DROP POLICY IF EXISTS "Users can view item history" ON order_item_history;
DROP POLICY IF EXISTS "Authenticated users can view item history" ON order_item_history;
CREATE POLICY "Org users can view order item history"
ON order_item_history FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can create item history" ON order_item_history;
DROP POLICY IF EXISTS "Authenticated users can create item history" ON order_item_history;
CREATE POLICY "Org users can create order item history"
ON order_item_history FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- =====================================================
-- 15. ATUALIZAR RLS POLICIES - DELIVERY_DATE_CHANGES
-- =====================================================

DROP POLICY IF EXISTS "Users can view delivery date changes" ON delivery_date_changes;
CREATE POLICY "Org users can view delivery date changes"
ON delivery_date_changes FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create delivery date changes" ON delivery_date_changes;
CREATE POLICY "Org users can create delivery date changes"
ON delivery_date_changes FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can update date change tracking" ON delivery_date_changes;
CREATE POLICY "Org users can update delivery date changes"
ON delivery_date_changes FOR UPDATE
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Any authenticated user can delete delivery date changes" ON delivery_date_changes;
CREATE POLICY "Org users can delete delivery date changes"
ON delivery_date_changes FOR DELETE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 16. ATUALIZAR RLS POLICIES - ORDER_COMPLETION_NOTES
-- =====================================================

DROP POLICY IF EXISTS "Users can view completion notes" ON order_completion_notes;
DROP POLICY IF EXISTS "Authenticated users can view completion notes" ON order_completion_notes;
CREATE POLICY "Org users can view order completion notes"
ON order_completion_notes FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create completion notes" ON order_completion_notes;
DROP POLICY IF EXISTS "Authenticated users can create completion notes" ON order_completion_notes;
CREATE POLICY "Org users can create order completion notes"
ON order_completion_notes FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Users can update completion notes" ON order_completion_notes;
DROP POLICY IF EXISTS "Authenticated users can update completion notes" ON order_completion_notes;
CREATE POLICY "Org users can update order completion notes"
ON order_completion_notes FOR UPDATE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 17. ATUALIZAR RLS POLICIES - LAB_ITEM_WORK
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view lab work" ON lab_item_work;
CREATE POLICY "Org users can view lab work"
ON lab_item_work FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Authenticated users can create lab work" ON lab_item_work;
CREATE POLICY "Org users can create lab work"
ON lab_item_work FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Authenticated users can update lab work" ON lab_item_work;
CREATE POLICY "Org users can update lab work"
ON lab_item_work FOR UPDATE
USING (organization_id = get_user_organization_id());

-- =====================================================
-- 18. ATUALIZAR RLS POLICIES - MENTION_TAGS
-- =====================================================

DROP POLICY IF EXISTS "Users can view mention tags" ON mention_tags;
CREATE POLICY "Org users can view mention tags"
ON mention_tags FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create mention tags" ON mention_tags;
CREATE POLICY "Org users can create mention tags"
ON mention_tags FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() OR organization_id IS NULL);
