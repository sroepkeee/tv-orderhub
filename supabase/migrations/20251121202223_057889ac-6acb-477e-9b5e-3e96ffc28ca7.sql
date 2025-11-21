-- Dropar constraints antigas que apontam para auth.users
ALTER TABLE public.purchase_requests
DROP CONSTRAINT IF EXISTS purchase_requests_requested_by_fkey,
DROP CONSTRAINT IF EXISTS purchase_requests_approved_by_fkey;

-- Recriar Foreign Keys apontando para public.profiles
ALTER TABLE public.purchase_requests
ADD CONSTRAINT purchase_requests_requested_by_fkey 
  FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT purchase_requests_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;