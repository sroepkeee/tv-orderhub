-- Add user_type and document fields to profiles for technician access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'internal';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document TEXT;

-- user_type: 'internal' (colaborador interno) | 'technician' (técnico externo)
-- document: CPF/CNPJ do técnico para match com customer_name/customer_document nas orders

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_document ON profiles(document);

-- Add comment
COMMENT ON COLUMN profiles.user_type IS 'Tipo de usuário: internal (colaborador) ou technician (técnico externo)';
COMMENT ON COLUMN profiles.document IS 'CPF/CNPJ do técnico para vincular às ordens de remessa';