-- Função para subtrair dias úteis (exclui sábados e domingos)
CREATE OR REPLACE FUNCTION subtract_business_days(
  start_date DATE,
  business_days INTEGER
) RETURNS DATE AS $$
DECLARE
  result_date DATE := start_date;
  days_subtracted INTEGER := 0;
BEGIN
  WHILE days_subtracted < business_days LOOP
    result_date := result_date - INTERVAL '1 day';
    
    -- Contar apenas se não for fim de semana (0=Domingo, 6=Sábado)
    IF EXTRACT(DOW FROM result_date) NOT IN (0, 6) THEN
      days_subtracted := days_subtracted + 1;
    END IF;
  END LOOP;
  
  RETURN result_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comentário de auditoria
COMMENT ON FUNCTION subtract_business_days IS 'Calcula data subtraindo N dias úteis (exclui sábados e domingos)';

-- Aplicar cálculo retroativo nos pedidos existentes (34 pedidos)
-- Calcula issue_date = delivery_date - 10 dias úteis
UPDATE orders 
SET issue_date = subtract_business_days(delivery_date, 10)
WHERE issue_date IS NULL
  AND delivery_date IS NOT NULL;