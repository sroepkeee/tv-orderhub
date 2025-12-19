-- Add is_manager column to profiles for easier manager identification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_manager boolean DEFAULT false;

-- Add whatsapp column to profiles if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp text;

-- Create index for faster manager lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_manager ON public.profiles(is_manager) WHERE is_manager = true;

-- Update existing admins to be managers
UPDATE public.profiles
SET is_manager = true
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_manager IS 'Indicates if user receives management reports via WhatsApp';