-- Remover políticas permissivas/redundantes
DROP POLICY IF EXISTS "Users can view all stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can create stock movements" ON public.stock_movements;

-- As políticas restantes já são restritivas por organização:
-- - "Org users can view stock movements" - SELECT restrito por organization_id
-- - "Org users can create stock movements" - INSERT restrito por organization_id  
-- - "Org users can update stock movements" - UPDATE restrito por organization_id
-- - "Org admins can delete stock movements" - DELETE restrito a admins da org

-- Adicionar política para service_role (Edge Functions e triggers)
CREATE POLICY "Service role manages stock movements"
ON public.stock_movements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);