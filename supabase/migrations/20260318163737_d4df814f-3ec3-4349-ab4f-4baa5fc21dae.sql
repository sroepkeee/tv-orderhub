
-- Remove the overly permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON profiles;

-- Drop existing policies to recreate them properly scoped
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Org users can view profiles in their org" ON profiles;

-- Users can always view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

-- Users can view profiles in their organization
CREATE POLICY "Org members can view org profiles"
ON profiles FOR SELECT
USING (
  organization_id = get_user_organization_id()
);

-- Allow viewing profiles with no org (new users during onboarding)
CREATE POLICY "Users can view unassigned profiles"
ON profiles FOR SELECT
USING (
  organization_id IS NULL
  AND id = auth.uid()
);
