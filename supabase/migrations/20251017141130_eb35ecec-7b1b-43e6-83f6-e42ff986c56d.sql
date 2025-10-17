-- Adicionar campos de SLA e rastreamento aos itens
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS sla_days integer,
ADD COLUMN IF NOT EXISTS is_imported boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS import_lead_time_days integer,
ADD COLUMN IF NOT EXISTS sla_deadline date,
ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS phase_started_at timestamp with time zone DEFAULT now();

-- Comentários explicativos
COMMENT ON COLUMN public.order_items.sla_days IS 'SLA específico do item em dias úteis';
COMMENT ON COLUMN public.order_items.is_imported IS 'Indica se o item é importado (apenas para compras)';
COMMENT ON COLUMN public.order_items.import_lead_time_days IS 'Prazo de importação em dias (se aplicável)';
COMMENT ON COLUMN public.order_items.sla_deadline IS 'Data limite calculada baseada no SLA';
COMMENT ON COLUMN public.order_items.current_phase IS 'Fase atual do item: pending, in_process, quality_check, completed, delayed';
COMMENT ON COLUMN public.order_items.phase_started_at IS 'Data/hora do início da fase atual';

-- Função para calcular SLA padrão baseado no tipo de item
CREATE OR REPLACE FUNCTION public.calculate_item_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se SLA não foi definido manualmente, calcular automaticamente
  IF NEW.sla_days IS NULL THEN
    CASE
      -- Itens em estoque: 2 dias (48h)
      WHEN NEW.item_source_type = 'in_stock' THEN
        NEW.sla_days := 2;
      
      -- Itens de produção: 7 dias (atualizado de 10 para 7)
      WHEN NEW.item_source_type = 'production' THEN
        NEW.sla_days := 7;
      
      -- Itens de compra: 15 dias padrão (ou usar import_lead_time_days se definido)
      WHEN NEW.item_source_type = 'out_of_stock' THEN
        IF NEW.is_imported AND NEW.import_lead_time_days IS NOT NULL THEN
          NEW.sla_days := NEW.import_lead_time_days;
        ELSE
          -- Padrão para compras nacionais
          NEW.sla_days := 15;
        END IF;
      
      ELSE
        NEW.sla_days := 7; -- Padrão genérico
    END CASE;
  END IF;

  -- Calcular data limite do SLA se não foi definida
  IF NEW.sla_deadline IS NULL AND NEW.delivery_date IS NOT NULL THEN
    -- Usar função de subtração de dias úteis
    NEW.sla_deadline := subtract_business_days(NEW.delivery_date, NEW.sla_days);
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger para calcular SLA automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_item_sla ON public.order_items;
CREATE TRIGGER trigger_calculate_item_sla
  BEFORE INSERT OR UPDATE OF item_source_type, is_imported, import_lead_time_days, delivery_date
  ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_item_sla();

-- Atualizar itens existentes com SLAs padrão
UPDATE public.order_items
SET 
  sla_days = CASE 
    WHEN item_source_type = 'in_stock' THEN 2
    WHEN item_source_type = 'production' THEN 7
    WHEN item_source_type = 'out_of_stock' THEN 15
    ELSE 7
  END,
  current_phase = CASE
    WHEN item_status = 'completed' THEN 'completed'
    ELSE 'in_process'
  END
WHERE sla_days IS NULL;