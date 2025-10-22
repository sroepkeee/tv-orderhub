-- Criar tabela para trabalhos de laboratório por item
CREATE TABLE IF NOT EXISTS public.lab_item_work (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  
  -- Status do trabalho
  work_status TEXT NOT NULL DEFAULT 'pending' CHECK (work_status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Firmware
  firmware_updated BOOLEAN DEFAULT FALSE,
  firmware_version TEXT,
  firmware_notes TEXT,
  
  -- Imagem
  image_installed BOOLEAN DEFAULT FALSE,
  image_version TEXT,
  image_notes TEXT,
  
  -- Peças para conserto
  repair_parts JSONB DEFAULT '[]'::jsonb, -- Array de {part_code, description, quantity, notes}
  
  -- Testes e validações
  tests_performed JSONB DEFAULT '[]'::jsonb, -- Array de {test_name, result, notes, performed_at}
  
  -- Observações gerais
  general_notes TEXT,
  
  -- Controle
  assigned_to UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garantir um registro por item
  UNIQUE(order_item_id)
);

-- Índices para performance
CREATE INDEX idx_lab_work_order ON public.lab_item_work(order_id);
CREATE INDEX idx_lab_work_status ON public.lab_item_work(work_status);
CREATE INDEX idx_lab_work_assigned ON public.lab_item_work(assigned_to);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_lab_item_work_updated_at
  BEFORE UPDATE ON public.lab_item_work
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.lab_item_work ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ver trabalhos de laboratório
CREATE POLICY "Authenticated users can view lab work"
  ON public.lab_item_work
  FOR SELECT
  TO authenticated
  USING (true);

-- Usuários podem criar trabalhos de laboratório
CREATE POLICY "Authenticated users can create lab work"
  ON public.lab_item_work
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuários podem atualizar trabalhos de laboratório
CREATE POLICY "Authenticated users can update lab work"
  ON public.lab_item_work
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.lab_item_work IS 'Registro de trabalhos realizados pelo laboratório em cada item do pedido';
COMMENT ON COLUMN public.lab_item_work.repair_parts IS 'JSON array com peças usadas no conserto: [{part_code, description, quantity, notes}]';
COMMENT ON COLUMN public.lab_item_work.tests_performed IS 'JSON array com testes realizados: [{test_name, result, notes, performed_at}]';