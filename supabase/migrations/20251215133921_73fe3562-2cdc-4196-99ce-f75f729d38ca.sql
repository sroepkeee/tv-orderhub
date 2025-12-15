-- Create compliance policies table
CREATE TABLE public.ai_compliance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create compliance rules table
CREATE TABLE public.ai_compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_pattern TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  policy_id UUID REFERENCES public.ai_compliance_policies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  action_type TEXT DEFAULT 'alert',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_compliance_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for AI Agent admins
CREATE POLICY "AI Agent admins can manage policies"
ON public.ai_compliance_policies
FOR ALL
USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "AI Agent admins can manage rules"
ON public.ai_compliance_rules
FOR ALL
USING (is_ai_agent_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_compliance_rules_policy ON public.ai_compliance_rules(policy_id);
CREATE INDEX idx_compliance_rules_active ON public.ai_compliance_rules(is_active);
CREATE INDEX idx_compliance_rules_risk ON public.ai_compliance_rules(risk_level);