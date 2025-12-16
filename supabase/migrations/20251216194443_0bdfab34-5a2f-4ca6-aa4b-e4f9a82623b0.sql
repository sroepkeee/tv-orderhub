-- 1. Adicionar colunas de handoff humanizado na tabela conversation_sentiment_cache
ALTER TABLE conversation_sentiment_cache 
ADD COLUMN IF NOT EXISTS requires_human_handoff BOOLEAN DEFAULT FALSE;

ALTER TABLE conversation_sentiment_cache 
ADD COLUMN IF NOT EXISTS handoff_reason TEXT;

ALTER TABLE conversation_sentiment_cache 
ADD COLUMN IF NOT EXISTS handoff_detected_at TIMESTAMPTZ;

-- 2. Expandir keywords de handoff humanizado para ambos os tipos de agente
UPDATE ai_agent_config SET human_handoff_keywords = ARRAY[
  'humano', 'atendente', 'pessoa', 'falar com alguém', 'suporte',
  'gerente', 'supervisor', 'gestor', 'coordenador', 'responsável',
  'chefe', 'diretor', 'falar com pessoa real', 'quero atendente',
  'atendimento real', 'não quero robô', 'não quero bot', 
  'parar de responder', 'passar para humano', 'transferir',
  'escalar', 'reclamação formal', 'ouvidoria', 'SAC',
  'pessoa de verdade', 'atendente humano', 'falar com gente',
  'falar com alguem de verdade', 'quero humano', 'preciso de humano',
  'quero falar com gente', 'atendimento humano', 'nao quero robo'
];