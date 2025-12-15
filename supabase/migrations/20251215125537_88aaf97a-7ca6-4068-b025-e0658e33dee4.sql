-- Configuração principal do agente de IA
CREATE TABLE public.ai_agent_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL DEFAULT 'Assistente Imply',
  personality TEXT NOT NULL DEFAULT 'Profissional, amigável e prestativo',
  tone_of_voice TEXT NOT NULL DEFAULT 'formal',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  is_active BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end TIME DEFAULT '18:00',
  respect_working_hours BOOLEAN NOT NULL DEFAULT true,
  max_notifications_per_day INTEGER DEFAULT 5,
  min_interval_minutes INTEGER DEFAULT 60,
  signature TEXT DEFAULT 'Equipe Imply',
  custom_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Base de conhecimento RAG
CREATE TABLE public.ai_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  content TEXT NOT NULL,
  keywords TEXT[],
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Regras de notificação
CREATE TABLE public.ai_notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'status_change', 'deadline', 'manual', 'scheduled'
  trigger_status TEXT, -- Status que dispara a regra
  trigger_conditions JSONB DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT ARRAY['whatsapp'],
  priority INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Templates de mensagem
CREATE TABLE public.ai_notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'whatsapp', 'email'
  subject TEXT, -- Para e-mail
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT DEFAULT 'geral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contatos de clientes
CREATE TABLE public.customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_document TEXT,
  email TEXT,
  whatsapp TEXT,
  preferred_channel TEXT DEFAULT 'whatsapp',
  opt_in_whatsapp BOOLEAN DEFAULT true,
  opt_in_email BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Log de notificações enviadas
CREATE TABLE public.ai_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.ai_notification_rules(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.ai_notification_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  message_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
  error_message TEXT,
  external_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lista de Super Admins autorizados
CREATE TABLE public.ai_agent_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir Super Admins autorizados
INSERT INTO public.ai_agent_admins (email) VALUES 
  ('sander.roepke@gmail.com'),
  ('teste@imply.com');

-- Inserir configuração inicial do agente
INSERT INTO public.ai_agent_config (agent_name, personality, tone_of_voice) VALUES 
  ('Assistente Imply', 'Profissional, cordial e prestativo. Representa a empresa Imply Tecnologia com excelência no atendimento ao cliente.', 'formal');

-- Inserir templates padrão
INSERT INTO public.ai_notification_templates (name, channel, subject, content, variables, category) VALUES
  ('Pedido Criado - WhatsApp', 'whatsapp', NULL, 
   'Olá {{customer_name}}! 👋

Seu pedido *#{{order_number}}* foi registrado com sucesso.

📦 *Itens:* {{items_count}} item(s)
📅 *Previsão de entrega:* {{delivery_date}}

Acompanhe o status do seu pedido. Qualquer dúvida, estamos à disposição!

{{signature}}', 
   ARRAY['customer_name', 'order_number', 'items_count', 'delivery_date', 'signature'], 'status'),
  
  ('Em Produção - WhatsApp', 'whatsapp', NULL,
   'Olá {{customer_name}}! 🏭

Seu pedido *#{{order_number}}* entrou em produção!

Estamos trabalhando para entregar com qualidade e no prazo.

📅 *Previsão:* {{delivery_date}}

{{signature}}',
   ARRAY['customer_name', 'order_number', 'delivery_date', 'signature'], 'status'),

  ('Em Trânsito - WhatsApp', 'whatsapp', NULL,
   'Olá {{customer_name}}! 🚚

Ótima notícia! Seu pedido *#{{order_number}}* está a caminho!

🚛 *Transportadora:* {{carrier_name}}
📍 *Rastreio:* {{tracking_code}}

{{signature}}',
   ARRAY['customer_name', 'order_number', 'carrier_name', 'tracking_code', 'signature'], 'status'),

  ('Entregue - WhatsApp', 'whatsapp', NULL,
   'Olá {{customer_name}}! ✅

Seu pedido *#{{order_number}}* foi entregue com sucesso!

Esperamos que esteja tudo perfeito. Caso tenha alguma dúvida ou feedback, estamos aqui para ajudar!

Obrigado por escolher a Imply! 💙

{{signature}}',
   ARRAY['customer_name', 'order_number', 'signature'], 'status'),

  ('Pedido Criado - Email', 'email', 'Pedido #{{order_number}} - Confirmação de Registro',
   '<h2>Olá {{customer_name}}!</h2>
<p>Seu pedido <strong>#{{order_number}}</strong> foi registrado com sucesso.</p>
<ul>
  <li><strong>Itens:</strong> {{items_count}} item(s)</li>
  <li><strong>Previsão de entrega:</strong> {{delivery_date}}</li>
</ul>
<p>Você receberá atualizações sobre o andamento do seu pedido.</p>
<p>Atenciosamente,<br>{{signature}}</p>',
   ARRAY['customer_name', 'order_number', 'items_count', 'delivery_date', 'signature'], 'status');

-- Inserir regras padrão
INSERT INTO public.ai_notification_rules (name, description, trigger_type, trigger_status, channels, template_id, is_active) VALUES
  ('Pedido Criado', 'Notifica o cliente quando um novo pedido é criado', 'status_change', 'almox_ssm_pending', ARRAY['whatsapp', 'email'], 
   (SELECT id FROM public.ai_notification_templates WHERE name = 'Pedido Criado - WhatsApp'), false),
  ('Em Produção', 'Notifica quando o pedido entra em produção', 'status_change', 'separation_started', ARRAY['whatsapp'], 
   (SELECT id FROM public.ai_notification_templates WHERE name = 'Em Produção - WhatsApp'), false),
  ('Em Trânsito', 'Notifica quando o pedido sai para entrega', 'status_change', 'in_transit', ARRAY['whatsapp'], 
   (SELECT id FROM public.ai_notification_templates WHERE name = 'Em Trânsito - WhatsApp'), false),
  ('Entregue', 'Notifica quando o pedido é entregue', 'status_change', 'delivered', ARRAY['whatsapp'], 
   (SELECT id FROM public.ai_notification_templates WHERE name = 'Entregue - WhatsApp'), false);

-- Inserir conhecimento base inicial
INSERT INTO public.ai_knowledge_base (title, category, content, keywords, priority) VALUES
  ('Sobre a Imply', 'empresa', 'A Imply Tecnologia é uma empresa brasileira especializada em soluções de autoatendimento, painéis de LED, sistemas de bilheteria e entretenimento. Com sede no Rio Grande do Sul, atende clientes em todo o Brasil e América Latina.', ARRAY['imply', 'empresa', 'sobre', 'quem somos'], 10),
  ('Horário de Atendimento', 'atendimento', 'O atendimento ao cliente funciona de segunda a sexta-feira, das 8h às 18h (horário de Brasília). Fora deste horário, as mensagens serão respondidas no próximo dia útil.', ARRAY['horário', 'atendimento', 'funcionamento'], 9),
  ('Prazos de Entrega', 'logistica', 'Os prazos de entrega variam conforme a região e o tipo de produto. Produtos em estoque: 2-5 dias úteis. Produtos sob encomenda: 15-30 dias úteis. Instalações: prazo definido em proposta comercial.', ARRAY['prazo', 'entrega', 'tempo', 'dias'], 8),
  ('Política de Garantia', 'garantia', 'Todos os equipamentos Imply possuem garantia de 12 meses contra defeitos de fabricação. A garantia não cobre mau uso, danos por acidentes ou instalação inadequada. Para acionar a garantia, entre em contato com nosso suporte técnico.', ARRAY['garantia', 'defeito', 'reparo', 'troca'], 8);

-- Enable RLS
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_admins ENABLE ROW LEVEL SECURITY;

-- Função para verificar se é Super Admin do Agente
CREATE OR REPLACE FUNCTION public.is_ai_agent_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.ai_agent_admins aa
    JOIN auth.users u ON u.email = aa.email
    WHERE u.id = _user_id AND aa.is_active = true
  );
$$;

-- RLS Policies - Apenas Super Admins podem acessar
CREATE POLICY "Super Admins can manage agent config" ON public.ai_agent_config
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can manage knowledge base" ON public.ai_knowledge_base
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can manage notification rules" ON public.ai_notification_rules
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can manage templates" ON public.ai_notification_templates
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can manage customer contacts" ON public.customer_contacts
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can view notification log" ON public.ai_notification_log
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

CREATE POLICY "Super Admins can manage admin list" ON public.ai_agent_admins
  FOR ALL USING (is_ai_agent_admin(auth.uid()));

-- Índices para performance
CREATE INDEX idx_ai_knowledge_base_category ON public.ai_knowledge_base(category);
CREATE INDEX idx_ai_knowledge_base_keywords ON public.ai_knowledge_base USING GIN(keywords);
CREATE INDEX idx_ai_notification_rules_trigger ON public.ai_notification_rules(trigger_type, trigger_status);
CREATE INDEX idx_ai_notification_log_order ON public.ai_notification_log(order_id);
CREATE INDEX idx_ai_notification_log_status ON public.ai_notification_log(status);
CREATE INDEX idx_customer_contacts_document ON public.customer_contacts(customer_document);

-- Trigger para updated_at
CREATE TRIGGER update_ai_agent_config_updated_at BEFORE UPDATE ON public.ai_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_knowledge_base_updated_at BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_notification_rules_updated_at BEFORE UPDATE ON public.ai_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_notification_templates_updated_at BEFORE UPDATE ON public.ai_notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_contacts_updated_at BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();