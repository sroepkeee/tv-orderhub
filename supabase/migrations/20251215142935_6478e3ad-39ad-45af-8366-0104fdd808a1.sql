-- Create test carrier for WhatsApp testing
INSERT INTO public.carriers (name, whatsapp, contact_person, is_active, notes)
VALUES ('TESTE - Sanderson', '51993291603', 'Sanderson Roepke', true, 'Contato de teste para validação do sistema WhatsApp')
ON CONFLICT DO NOTHING;