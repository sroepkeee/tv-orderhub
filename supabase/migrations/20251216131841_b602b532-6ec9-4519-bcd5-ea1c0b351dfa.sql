-- Permitir que usuários do Laboratório movam pedidos para a fase Embalagem
UPDATE phase_permissions 
SET can_edit = true 
WHERE role = 'laboratory' AND phase_key = 'packaging';