CREATE TABLE public.rateio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text UNIQUE NOT NULL,
  description text NOT NULL,
  business_unit text,
  management text,
  business_area text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rateio_projects_code ON public.rateio_projects(project_code);

ALTER TABLE public.rateio_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rateio_project_code text