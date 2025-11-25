-- Migration 2: Criar fase purchases e permissões
-- Inserir fase de compras no phase_config com order_index 3
INSERT INTO phase_config (
  phase_key, 
  display_name, 
  description, 
  responsible_role, 
  order_index, 
  color, 
  icon
) VALUES (
  'purchases',
  'Compras',
  'Gestão de solicitações e acompanhamento de compras',
  'purchases',
  3,
  'amber',
  'ShoppingCart'
);

-- Ajustar order_index das fases subsequentes (de 3 em diante, exceto purchases)
UPDATE phase_config 
SET order_index = order_index + 1 
WHERE order_index >= 3 
  AND phase_key != 'purchases';

-- Criar permissões para a fase de compras
INSERT INTO phase_permissions (role, phase_key, can_view, can_edit, can_delete) VALUES
-- Role purchases tem controle total na sua fase
('purchases', 'purchases', true, true, true),
-- Purchases visualiza order_generation (contexto)
('purchases', 'order_generation', true, false, false),
-- Admin tem acesso total
('admin', 'purchases', true, true, true),
-- Order generation visualiza compras (contexto)
('order_generation', 'purchases', true, false, false);