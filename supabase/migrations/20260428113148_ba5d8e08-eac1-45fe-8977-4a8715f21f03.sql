
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_founder(uuid) TO authenticated;
