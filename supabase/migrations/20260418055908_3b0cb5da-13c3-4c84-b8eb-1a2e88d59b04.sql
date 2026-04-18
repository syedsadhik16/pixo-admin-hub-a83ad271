-- 1. Extend profiles with CRM/contact fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS user_type text;

-- 2. Lead pipeline overlay (CRM stage per user)
CREATE TABLE IF NOT EXISTS public.lead_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stage text NOT NULL DEFAULT 'cold' CHECK (stage IN ('cold','warm','hot','subscribed','inactive','dropped')),
  remarks text,
  next_follow_up_at timestamptz,
  owner_user_id uuid,
  pricing_page_visited boolean DEFAULT false,
  payment_page_visited boolean DEFAULT false,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_stage ON public.lead_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_owner ON public.lead_pipeline(owner_user_id);
ALTER TABLE public.lead_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage lead pipeline" ON public.lead_pipeline
  FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view lead pipeline" ON public.lead_pipeline
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_lead_pipeline_updated_at
  BEFORE UPDATE ON public.lead_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Lead notes (thread per user)
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_user_id uuid,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_user ON public.lead_notes(user_id, created_at DESC);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage lead notes" ON public.lead_notes
  FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view lead notes" ON public.lead_notes
  FOR SELECT USING (public.is_staff(auth.uid()));

-- 4. Payment funnel events
CREATE TABLE IF NOT EXISTS public.payment_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'parent_linked','pricing_visited','payment_initiated','payment_page_entered',
    'payment_success','payment_failed','subscription_activated'
  )),
  plan_name text,
  amount numeric,
  failure_reason text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_user ON public.payment_funnel_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_event ON public.payment_funnel_events(event_type);
ALTER TABLE public.payment_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage funnel events" ON public.payment_funnel_events
  FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Users insert own funnel events" ON public.payment_funnel_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own funnel events" ON public.payment_funnel_events
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Login events
CREATE TABLE IF NOT EXISTS public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_in_at timestamptz DEFAULT now(),
  device_type text,
  platform text,
  browser text,
  app_source text,
  ip_address text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_login_user ON public.user_login_events(user_id, logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_date ON public.user_login_events(logged_in_at DESC);
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view login events" ON public.user_login_events
  FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Users insert own login events" ON public.user_login_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own login events" ON public.user_login_events
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Activity logs
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON public.user_activity_logs(activity_type);
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view activity logs" ON public.user_activity_logs
  FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Users insert own activity" ON public.user_activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own activity" ON public.user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 7. Exports audit
CREATE TABLE IF NOT EXISTS public.exports_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  export_type text NOT NULL,
  row_count integer,
  filters jsonb DEFAULT '{}'::jsonb,
  destination text DEFAULT 'csv',
  file_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exports_actor ON public.exports_audit(actor_user_id, created_at DESC);
ALTER TABLE public.exports_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage exports audit" ON public.exports_audit
  FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Actor insert own exports" ON public.exports_audit
  FOR INSERT WITH CHECK (auth.uid() = actor_user_id);