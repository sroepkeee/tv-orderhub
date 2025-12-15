-- Tabela de regras/políticas de IA
CREATE TABLE public.ai_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_description text NOT NULL,
  policy text NOT NULL,
  rule text NOT NULL,
  rule_risk text NOT NULL CHECK (rule_risk IN ('low', 'moderate', 'high', 'critical')),
  action text NOT NULL DEFAULT 'log' CHECK (action IN ('log', 'warn', 'block', 'escalate')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ai_rules_policy ON public.ai_rules(policy);
CREATE INDEX idx_ai_rules_risk ON public.ai_rules(rule_risk);
CREATE INDEX idx_ai_rules_active ON public.ai_rules(is_active);

-- Habilitar RLS
ALTER TABLE public.ai_rules ENABLE ROW LEVEL SECURITY;

-- Política de acesso (apenas admins do AI Agent)
CREATE POLICY "AI Agent admins can manage rules"
  ON public.ai_rules FOR ALL
  USING (is_ai_agent_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_ai_rules_updated_at
  BEFORE UPDATE ON public.ai_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários na tabela
COMMENT ON TABLE public.ai_rules IS 'Regras e políticas de negócio para o agente de IA';
COMMENT ON COLUMN public.ai_rules.policy IS 'Nome/categoria da política (ex: Privacidade, Comunicação)';
COMMENT ON COLUMN public.ai_rules.rule_description IS 'Descrição curta da regra';
COMMENT ON COLUMN public.ai_rules.rule IS 'Texto completo da regra/instrução';
COMMENT ON COLUMN public.ai_rules.rule_risk IS 'Nível de risco: low, moderate, high, critical';
COMMENT ON COLUMN public.ai_rules.action IS 'Ação a tomar: log, warn, block, escalate';