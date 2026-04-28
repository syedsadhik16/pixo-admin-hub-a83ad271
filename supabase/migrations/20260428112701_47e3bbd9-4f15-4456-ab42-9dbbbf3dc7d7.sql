
-- 1. Tighten permissive INSERT policies on event tables
DROP POLICY IF EXISTS "Anyone can insert lead events" ON public.lead_events;
CREATE POLICY "Anyone can insert lead events"
ON public.lead_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can insert payment funnel events" ON public.payment_funnel_events;
CREATE POLICY "Anyone can insert payment funnel events"
ON public.payment_funnel_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IS NOT NULL
  AND (user_id = auth.uid() OR auth.uid() IS NULL)
);

-- 2. Storage: drop broad SELECT policies on public buckets (public URLs still serve files)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND pg_get_expr(polqual, polrelid) ILIKE '%curriculum-media%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
  END LOOP;
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND pg_get_expr(polqual, polrelid) ILIKE '%brand-assets%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
  END LOOP;
END $$;

-- Allow only authenticated staff/admins to LIST objects in these buckets;
-- public reads still work via the public bucket's CDN URLs without RLS.
CREATE POLICY "Authenticated can read curriculum-media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'curriculum-media');

CREATE POLICY "Authenticated can read brand-assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'brand-assets');

-- 3. Lock down SECURITY DEFINER functions
-- Trigger-only / internal functions: revoke from everyone
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sales_transactions_autofill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_events_autobump() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_commission(numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_lead_pipeline(uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- RLS helper functions: only authenticated users need to call (RLS engine uses owner privileges anyway)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_founder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_founder(uuid) TO authenticated;
