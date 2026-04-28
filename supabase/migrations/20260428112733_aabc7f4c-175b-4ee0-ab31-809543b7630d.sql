
-- Drop the SELECT policies on public buckets entirely; public URLs continue to work
DROP POLICY IF EXISTS "Authenticated can read curriculum-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read brand-assets" ON storage.objects;

-- Revoke EXECUTE on RLS helper functions from authenticated as well.
-- They are owned by postgres (superuser) and will still work inside RLS expressions
-- because RLS policy expressions are evaluated under the policy owner's rights.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_founder(uuid) FROM authenticated;
