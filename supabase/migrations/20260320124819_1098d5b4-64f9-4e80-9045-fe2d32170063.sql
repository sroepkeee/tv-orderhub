-- Fix NULL organization_id for existing users
UPDATE profiles p
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = p.id
  AND om.is_active = true
  AND p.organization_id IS NULL;

-- Trigger to auto-sync profiles.organization_id when organization_members changes
CREATE OR REPLACE FUNCTION public.sync_profile_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE profiles SET organization_id = NEW.organization_id
    WHERE id = NEW.user_id AND organization_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_profile_org
AFTER INSERT OR UPDATE ON organization_members
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_organization_id();