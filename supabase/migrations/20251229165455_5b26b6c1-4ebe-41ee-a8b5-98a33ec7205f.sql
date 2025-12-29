-- Adicionar campos para volumes, fotos e transferências entre técnicos
ALTER TABLE return_requests 
ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'warehouse',
ADD COLUMN IF NOT EXISTS destination_technician_id UUID REFERENCES technicians(id),
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC,
ADD COLUMN IF NOT EXISTS total_volumes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS volume_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Adicionar constraint para validar destination_type
ALTER TABLE return_requests 
ADD CONSTRAINT valid_destination_type CHECK (destination_type IN ('warehouse', 'technician'));

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_return_requests_destination_type ON return_requests(destination_type);
CREATE INDEX IF NOT EXISTS idx_return_requests_destination_technician ON return_requests(destination_technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_dispatches_technician ON technician_dispatches(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_dispatches_status ON technician_dispatches(status);

-- Comentários para documentação
COMMENT ON COLUMN return_requests.destination_type IS 'Tipo de destino: warehouse (armazém) ou technician (transferência)';
COMMENT ON COLUMN return_requests.destination_technician_id IS 'ID do técnico destino quando for transferência';
COMMENT ON COLUMN return_requests.total_weight_kg IS 'Peso total em kg dos volumes';
COMMENT ON COLUMN return_requests.total_volumes IS 'Número total de volumes';
COMMENT ON COLUMN return_requests.volume_details IS 'Detalhes de cada volume: peso, dimensões, tipo embalagem';
COMMENT ON COLUMN return_requests.photo_urls IS 'URLs das fotos anexadas';