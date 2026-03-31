-- Fix Letícia's organization membership
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
VALUES ('69aed6aa-5300-4e40-b66a-e71f3706db16', '0a6b1bb5-85f6-4484-8328-cbd10ce3d3c4', 'member', true)
ON CONFLICT DO NOTHING;

-- Fix her profile organization_id
UPDATE public.profiles 
SET organization_id = '69aed6aa-5300-4e40-b66a-e71f3706db16' 
WHERE id = '0a6b1bb5-85f6-4484-8328-cbd10ce3d3c4' 
AND organization_id IS NULL;