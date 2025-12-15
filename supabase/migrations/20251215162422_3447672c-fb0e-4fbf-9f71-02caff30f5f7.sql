-- =====================================================
-- SISTEMA RAG LOGÍSTICO - MIGRAÇÃO COMPLETA
-- =====================================================

-- 1. Enriquecer ai_knowledge_base com metadados logísticos
ALTER TABLE ai_knowledge_base 
ADD COLUMN IF NOT EXISTS carrier_name TEXT,
ADD COLUMN IF NOT EXISTS occurrence_type TEXT,
ADD COLUMN IF NOT EXISTS sla_category TEXT,
ADD COLUMN IF NOT EXISTS regions TEXT[],
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'procedimento';

-- 2. Criar tabela order_tracking_events (histórico de rastreio)
CREATE TABLE IF NOT EXISTS order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tracking_code TEXT,
  carrier_code TEXT,
  event_code TEXT,
  event_description TEXT,
  event_datetime TIMESTAMPTZ,
  location TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tracking_events_order_id ON order_tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_code ON order_tracking_events(tracking_code);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_datetime ON order_tracking_events(event_datetime DESC);

-- RLS para order_tracking_events
ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tracking events"
  ON order_tracking_events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tracking events"
  ON order_tracking_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tracking events"
  ON order_tracking_events FOR UPDATE
  USING (true);

-- 3. Criar tabela order_occurrences (ocorrências logísticas)
CREATE TABLE IF NOT EXISTS order_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  occurrence_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  description TEXT,
  carrier_response TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  sla_breached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_occurrences_order_id ON order_occurrences(order_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_type ON order_occurrences(occurrence_type);
CREATE INDEX IF NOT EXISTS idx_occurrences_resolved ON order_occurrences(resolved);

-- RLS para order_occurrences
ALTER TABLE order_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view occurrences"
  ON order_occurrences FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage occurrences"
  ON order_occurrences FOR ALL
  USING (true);

-- 4. Adicionar campos SLA na tabela orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS contracted_sla_days INTEGER,
ADD COLUMN IF NOT EXISTS sla_deadline DATE,
ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'within';

-- 5. Índices adicionais para ai_knowledge_base (filtros RAG contextuais)
CREATE INDEX IF NOT EXISTS idx_knowledge_carrier ON ai_knowledge_base(carrier_name) WHERE carrier_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_occurrence ON ai_knowledge_base(occurrence_type) WHERE occurrence_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_sla ON ai_knowledge_base(sla_category) WHERE sla_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_type ON ai_knowledge_base(document_type);

-- 6. Trigger para atualizar updated_at em order_occurrences
CREATE OR REPLACE TRIGGER update_order_occurrences_updated_at
  BEFORE UPDATE ON order_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();