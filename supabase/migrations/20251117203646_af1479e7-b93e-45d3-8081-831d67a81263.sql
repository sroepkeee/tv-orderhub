-- Remove o constraint CHECK de departamento
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_check;

-- Migrar dados antigos para novos padrões de departamento
UPDATE public.profiles
SET department = CASE
  WHEN department = 'Suporte' THEN 'TI'
  WHEN department = 'Almox SSM' THEN 'Almoxarifado'
  WHEN department = 'Almox Geral' THEN 'Almoxarifado'
  WHEN department = 'Compras' THEN 'Planejamento'
  WHEN department = 'Vendas' THEN 'Comercial'
  WHEN department = 'Estoque' THEN 'Almoxarifado'
  WHEN department = 'Lab' THEN 'Laboratório'
  ELSE department
END
WHERE department IN ('Suporte', 'Almox SSM', 'Almox Geral', 'Compras', 'Vendas', 'Estoque', 'Lab');