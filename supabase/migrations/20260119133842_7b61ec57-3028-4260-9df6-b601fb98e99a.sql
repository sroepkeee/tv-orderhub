-- Create return_tickets table for TOTVS Protheus integration
CREATE TABLE IF NOT EXISTS public.return_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  dispatch_id UUID REFERENCES public.technician_dispatches(id),
  ticket_number TEXT NOT NULL,
  totvs_order_number TEXT,
  technician_id UUID REFERENCES public.technicians(id),
  technician_name TEXT,
  customer_name TEXT,
  order_number TEXT,
  origin_warehouse TEXT,
  destination_warehouse TEXT DEFAULT 'imply_rs',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER DEFAULT 0,
  total_quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  totvs_return_number TEXT
);

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS return_ticket_seq START 1;

-- Enable RLS
ALTER TABLE public.return_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view return tickets from their organization"
  ON public.return_tickets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create return tickets for their organization"
  ON public.return_tickets FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update return tickets from their organization"
  ON public.return_tickets FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_return_ticket_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := to_char(now(), 'YYYY');
  seq_num := nextval('return_ticket_seq');
  RETURN 'RET-' || year_part || '-' || lpad(seq_num::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_return_tickets_org_status 
  ON public.return_tickets(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_return_tickets_dispatch 
  ON public.return_tickets(dispatch_id);