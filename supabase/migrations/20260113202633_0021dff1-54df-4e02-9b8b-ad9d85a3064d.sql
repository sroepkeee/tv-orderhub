-- Corrigir o api_token placeholder na instância WhatsApp
UPDATE whatsapp_instances 
SET api_token = 'MakQlnxoqp9' 
WHERE instance_key = 'megastart-MakQlnxoqp9' 
  AND (api_token IS NULL OR api_token = '' OR api_token LIKE '%SEU_TOKEN%' OR api_token LIKE '%API_KEY%');