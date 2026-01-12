-- Limpar instâncias duplicadas e manter apenas uma
-- Primeiro, desativar todas as instâncias antigas
UPDATE whatsapp_instances 
SET is_active = false
WHERE instance_key != 'megastart-Mvc2nB3dODR';

-- Garantir que a instância principal esteja configurada corretamente
UPDATE whatsapp_instances 
SET is_active = true, status = 'disconnected'
WHERE instance_key = 'megastart-Mvc2nB3dODR';