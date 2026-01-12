-- Fase 1: Corrigir número duplicado da THAIS (5555519919876 → 5551991987600)
UPDATE public.phase_managers 
SET whatsapp = '5551991987600' 
WHERE whatsapp = '5555519919876';

UPDATE public.management_report_recipients 
SET whatsapp = '5551991987600' 
WHERE whatsapp = '5555519919876';

-- Desativar gestores com WhatsApp vazio ou inválido
UPDATE public.phase_managers 
SET is_active = false 
WHERE whatsapp IS NULL OR whatsapp = '' OR LENGTH(whatsapp) < 10;

-- Fase 2: Limpar mensagens com números inválidos da fila
DELETE FROM public.message_queue 
WHERE recipient_whatsapp = '55' 
   OR recipient_whatsapp IS NULL 
   OR LENGTH(recipient_whatsapp) < 10;

-- Fase 4: Atualizar triggers para enviar a todos os gestores (ai_managers)
UPDATE public.ai_manager_trigger_config 
SET recipient_type = 'ai_managers'
WHERE is_active = true;