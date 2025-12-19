-- Add whatsapp and is_manager columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_manager boolean DEFAULT false;

-- Update the 3 manager users with WhatsApp number
UPDATE public.profiles 
SET whatsapp = '5551999050190', is_manager = true
WHERE email IN ('sander.roepke@gmail.com', 'teste@imply.com', 'sroepke@imply.com');

-- Add index for faster manager lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_manager ON public.profiles(is_manager) WHERE is_manager = true;