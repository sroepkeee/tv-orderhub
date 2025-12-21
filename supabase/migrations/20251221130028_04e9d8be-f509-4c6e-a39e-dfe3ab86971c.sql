-- Adicionar coluna can_advance na tabela phase_permissions
ALTER TABLE phase_permissions 
ADD COLUMN IF NOT EXISTS can_advance boolean DEFAULT false;

-- Por padrão, quem pode editar também pode avançar
UPDATE phase_permissions 
SET can_advance = can_edit 
WHERE can_edit = true;