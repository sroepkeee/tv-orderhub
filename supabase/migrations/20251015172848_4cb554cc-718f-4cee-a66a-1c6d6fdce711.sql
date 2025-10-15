-- Expandir tabela delivery_date_changes para rastreamento avançado
ALTER TABLE delivery_date_changes 
ADD COLUMN IF NOT EXISTS change_category TEXT CHECK (change_category IN ('justified', 'factory_delay', 'logistics_issue', 'client_request', 'internal_error', 'other')),
ADD COLUMN IF NOT EXISTS factory_followup_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS factory_contacted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS factory_response TEXT,
ADD COLUMN IF NOT EXISTS marked_as_stalling BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_delivery_date_changes_category ON delivery_date_changes(change_category);
CREATE INDEX IF NOT EXISTS idx_delivery_date_changes_followup ON delivery_date_changes(factory_followup_required);
CREATE INDEX IF NOT EXISTS idx_delivery_date_changes_stalling ON delivery_date_changes(marked_as_stalling);

-- Atualizar política RLS para permitir updates
DROP POLICY IF EXISTS "Users can update date change tracking" ON delivery_date_changes;
CREATE POLICY "Users can update date change tracking"
ON delivery_date_changes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);