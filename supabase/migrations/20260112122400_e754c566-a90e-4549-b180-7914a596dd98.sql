-- Deletar instância inativa que está causando confusão
DELETE FROM whatsapp_instances 
WHERE instance_key = 'megastart-M0xEQVmP04l';

-- Resetar status da instância ativa para reconexão limpa
UPDATE whatsapp_instances 
SET 
  status = 'disconnected',
  qrcode = NULL,
  qrcode_updated_at = NULL,
  phone_number = NULL,
  connected_at = NULL,
  updated_at = NOW()
WHERE instance_key = 'megastart-Mvc2nB3dODR';