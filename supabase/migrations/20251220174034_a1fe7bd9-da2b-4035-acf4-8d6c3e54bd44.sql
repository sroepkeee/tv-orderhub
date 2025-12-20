-- Tabela para captura de leads do SaaS V.I.V.O.
CREATE TABLE public.saas_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  segment TEXT,
  monthly_volume TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, demo_scheduled, converted, lost
  source TEXT DEFAULT 'landing', -- landing, referral, organic
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saas_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert leads (public form)
CREATE POLICY "Anyone can submit leads"
  ON public.saas_leads
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only admins can view leads
CREATE POLICY "Admins can view leads"
  ON public.saas_leads
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can update leads
CREATE POLICY "Admins can update leads"
  ON public.saas_leads
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can delete leads
CREATE POLICY "Admins can delete leads"
  ON public.saas_leads
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_saas_leads_updated_at
  BEFORE UPDATE ON public.saas_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();