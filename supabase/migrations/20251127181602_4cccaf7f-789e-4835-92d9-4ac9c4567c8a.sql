-- Criar fase carriers_chat para controle de acesso ao módulo de conversas com transportadoras
INSERT INTO phase_config (phase_key, display_name, responsible_role, order_index, icon, color, description)
VALUES ('carriers_chat', 'Chat Transportadoras', 'freight_quote', 99, 'MessageSquare', 'blue', 'Acesso ao módulo de conversas com transportadoras via WhatsApp');

-- Adicionar permissões para roles autorizadas a acessar conversas com transportadoras
INSERT INTO phase_permissions (phase_key, role, can_view, can_edit, can_delete)
VALUES 
  ('carriers_chat', 'admin', true, true, true),
  ('carriers_chat', 'freight_quote', true, true, false),
  ('carriers_chat', 'logistics', true, true, false),
  ('carriers_chat', 'invoicing', true, false, false);