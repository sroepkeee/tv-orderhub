-- Padronizar números de WhatsApp para 12 dígitos (novo padrão sem o 9)
-- Formato: 55 + DDD (2 dígitos) + Número (8 dígitos) = 12 dígitos

-- Atualizar phase_managers: 5551989198570 → 551891985870
UPDATE public.phase_managers 
SET whatsapp = CONCAT('55', SUBSTRING(whatsapp, 3, 2), SUBSTRING(whatsapp, 6))
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 13 
  AND whatsapp LIKE '55%' 
  AND SUBSTRING(whatsapp, 5, 1) = '9';

-- Atualizar management_report_recipients
UPDATE public.management_report_recipients 
SET whatsapp = CONCAT('55', SUBSTRING(whatsapp, 3, 2), SUBSTRING(whatsapp, 6))
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 13 
  AND whatsapp LIKE '55%' 
  AND SUBSTRING(whatsapp, 5, 1) = '9';

-- Atualizar profiles
UPDATE public.profiles 
SET whatsapp = CONCAT('55', SUBSTRING(whatsapp, 3, 2), SUBSTRING(whatsapp, 6))
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 13 
  AND whatsapp LIKE '55%' 
  AND SUBSTRING(whatsapp, 5, 1) = '9';

-- Atualizar carriers (transportadoras)
UPDATE public.carriers 
SET whatsapp = CONCAT('55', SUBSTRING(whatsapp, 3, 2), SUBSTRING(whatsapp, 6))
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 13 
  AND whatsapp LIKE '55%' 
  AND SUBSTRING(whatsapp, 5, 1) = '9';

-- Atualizar customer_contacts (contatos de clientes)
UPDATE public.customer_contacts 
SET whatsapp = CONCAT('55', SUBSTRING(whatsapp, 3, 2), SUBSTRING(whatsapp, 6))
WHERE whatsapp IS NOT NULL 
  AND LENGTH(whatsapp) = 13 
  AND whatsapp LIKE '55%' 
  AND SUBSTRING(whatsapp, 5, 1) = '9';