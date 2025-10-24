-- Create carriers table
CREATE TABLE carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  
  -- Contatos e e-mails
  email text NOT NULL,
  quote_email text,
  collection_email text,
  whatsapp text,
  phone text,
  
  -- Responsável
  contact_person text NOT NULL,
  contact_position text,
  
  -- Múltiplos contatos (array de objetos JSON)
  additional_contacts jsonb DEFAULT '[]'::jsonb,
  
  -- Cobertura geográfica
  service_states text[] DEFAULT ARRAY[]::text[],
  coverage_notes text,
  
  -- Status e observações
  is_active boolean DEFAULT true,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create freight_quotes table
CREATE TABLE freight_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id uuid NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'accepted', 'rejected', 'expired')),
  
  -- Dados completos da cotação (estrutura JSON com sender, recipient, cargo, etc)
  quote_request_data jsonb NOT NULL,
  
  -- Timestamps
  requested_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  response_received_at timestamptz,
  expires_at timestamptz,
  
  -- Integração N8N
  n8n_conversation_id text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create freight_quote_responses table
CREATE TABLE freight_quote_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES freight_quotes(id) ON DELETE CASCADE,
  
  -- Dados da cotação
  freight_value numeric(10,2),
  delivery_time_days integer,
  response_text text NOT NULL,
  additional_info jsonb DEFAULT '{}'::jsonb,
  
  -- Metadados
  responded_by text,
  received_at timestamptz DEFAULT now(),
  is_selected boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now()
);

-- Create carrier_conversations table
CREATE TABLE carrier_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id uuid NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  quote_id uuid REFERENCES freight_quotes(id) ON DELETE SET NULL,
  
  conversation_type text NOT NULL CHECK (conversation_type IN ('quote_request', 'follow_up', 'negotiation', 'general')),
  message_direction text NOT NULL CHECK (message_direction IN ('outbound', 'inbound')),
  message_content text NOT NULL,
  message_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Status de entrega
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  
  -- Integração N8N
  n8n_message_id text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_carriers_active ON carriers(is_active);
CREATE INDEX idx_carriers_states ON carriers USING GIN(service_states);
CREATE INDEX idx_freight_quotes_order ON freight_quotes(order_id);
CREATE INDEX idx_freight_quotes_carrier ON freight_quotes(carrier_id);
CREATE INDEX idx_freight_quotes_status ON freight_quotes(status);
CREATE INDEX idx_quote_responses_quote ON freight_quote_responses(quote_id);
CREATE INDEX idx_conversations_order ON carrier_conversations(order_id);
CREATE INDEX idx_conversations_carrier ON carrier_conversations(carrier_id);
CREATE INDEX idx_conversations_quote ON carrier_conversations(quote_id);

-- Enable Row Level Security
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_quote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carriers
CREATE POLICY "Authenticated users can view carriers" ON carriers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create carriers" ON carriers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update carriers" ON carriers
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete carriers" ON carriers
  FOR DELETE USING (true);

-- RLS Policies for freight_quotes
CREATE POLICY "Authenticated users can view quotes" ON freight_quotes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create quotes" ON freight_quotes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update quotes" ON freight_quotes
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete quotes" ON freight_quotes
  FOR DELETE USING (true);

-- RLS Policies for freight_quote_responses
CREATE POLICY "Authenticated users can view responses" ON freight_quote_responses
  FOR SELECT USING (true);

CREATE POLICY "System can insert responses" ON freight_quote_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update responses" ON freight_quote_responses
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete responses" ON freight_quote_responses
  FOR DELETE USING (true);

-- RLS Policies for carrier_conversations
CREATE POLICY "Authenticated users can view conversations" ON carrier_conversations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create conversations" ON carrier_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update conversations" ON carrier_conversations
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete conversations" ON carrier_conversations
  FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_carriers_updated_at 
  BEFORE UPDATE ON carriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_freight_quotes_updated_at 
  BEFORE UPDATE ON freight_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();