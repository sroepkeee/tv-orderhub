-- Adicionar usuário atual à whitelist de WhatsApp
INSERT INTO public.whatsapp_authorized_users (user_id, is_active)
SELECT id, true 
FROM auth.users 
WHERE email = 'sander.roepke@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_active = true;