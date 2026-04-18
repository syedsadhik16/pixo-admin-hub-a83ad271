-- Phase 1: Lead & Payment Intent Tracking
-- Creates lead_events table to capture every login attempt and lead-related signal,
-- extends lead_pipeline classification, and adds helper to auto-bump pipeline stage.

-- ============================================================
-- 1. lead_events: append-only log of all lead signals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,                 -- nullable: failed logins may have no user yet
  email TEXT NULL,
  phone TEXT NULL,
  event_type TEXT NOT NULL,          -- login_attempt, login_success, login_failed, payment_page_view, payment_initiated, payment_success, payment_failed, signup
  role_attempted TEXT NULL,          -- admin / parent / student / unknown
  success BOOLEAN NULL,
  failure_reason TEXT NULL,
  route TEXT NULL,
  app_source TEXT NULL,              -- web / mobile
  device_type TEXT NULL,
  browser TEXT NULL,
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_email ON public.lead_events (lower(email));
CREATE INDEX IF NOT EXISTS idx_lead_events_user_id ON public.lead_events (user_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON public.lead_events (event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON public.lead_events (created_at DESC);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authed) can insert their own signal — required to capture
-- pre-auth events such as failed logins. Read access is admin-only.
CREATE POLICY "Anyone can insert lead events"
  ON public.lead_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can read lead events"
  ON public.lead_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Admin can manage lead events"
  ON public.lead_events
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_founder(auth.uid()))
  WITH CHECK (public.is_admin_or_founder(auth.uid()));

-- ============================================================
-- 2. payment_funnel_events: allow anon insert too (pre-auth visitors)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert payment funnel events" ON public.payment_funnel_events;
CREATE POLICY "Anyone can insert payment funnel events"
  ON public.payment_funnel_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- 3. lead_pipeline: keep existing structure; add helper to upsert by user_id
-- and auto-classify stage based on highest signal seen.
-- Stages: cold, warm, hot, converted, dropped
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_lead_pipeline(
  _user_id UUID,
  _stage TEXT,
  _remarks TEXT DEFAULT NULL,
  _payment_page_visited BOOLEAN DEFAULT NULL,
  _pricing_page_visited BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage_rank INT;
  _existing_rank INT;
  _existing_stage TEXT;
  _id UUID;
BEGIN
  -- rank: cold=1, warm=2, hot=3, converted=4, dropped=0 (terminal but lower than cold)
  _stage_rank := CASE _stage
    WHEN 'cold' THEN 1
    WHEN 'warm' THEN 2
    WHEN 'hot' THEN 3
    WHEN 'converted' THEN 4
    WHEN 'dropped' THEN 0
    ELSE 1
  END;

  SELECT id, stage INTO _id, _existing_stage
    FROM public.lead_pipeline
   WHERE user_id = _user_id
   LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.lead_pipeline (user_id, stage, remarks,
      payment_page_visited, pricing_page_visited, last_activity_at)
    VALUES (_user_id, _stage, _remarks,
      COALESCE(_payment_page_visited, false),
      COALESCE(_pricing_page_visited, false), now())
    RETURNING id INTO _id;
  ELSE
    _existing_rank := CASE _existing_stage
      WHEN 'cold' THEN 1
      WHEN 'warm' THEN 2
      WHEN 'hot' THEN 3
      WHEN 'converted' THEN 4
      WHEN 'dropped' THEN 0
      ELSE 1
    END;

    UPDATE public.lead_pipeline
       SET stage = CASE WHEN _stage_rank > _existing_rank THEN _stage ELSE stage END,
           remarks = COALESCE(_remarks, remarks),
           payment_page_visited = COALESCE(_payment_page_visited, payment_page_visited),
           pricing_page_visited = COALESCE(_pricing_page_visited, pricing_page_visited),
           last_activity_at = now(),
           updated_at = now()
     WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

-- ============================================================
-- 4. Trigger: when a lead_event arrives with a user_id, auto-bump pipeline
-- ============================================================
CREATE OR REPLACE FUNCTION public.lead_events_autobump()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage TEXT;
  _payment_page BOOLEAN := NULL;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _stage := CASE NEW.event_type
    WHEN 'signup'             THEN 'cold'
    WHEN 'login_attempt'      THEN 'warm'
    WHEN 'login_failed'       THEN 'warm'
    WHEN 'login_success'      THEN 'warm'
    WHEN 'payment_page_view'  THEN 'hot'
    WHEN 'payment_initiated'  THEN 'hot'
    WHEN 'payment_failed'     THEN 'hot'
    WHEN 'payment_success'    THEN 'converted'
    ELSE NULL
  END;

  IF NEW.event_type = 'payment_page_view' THEN
    _payment_page := true;
  END IF;

  IF _stage IS NOT NULL THEN
    PERFORM public.upsert_lead_pipeline(NEW.user_id, _stage, NULL, _payment_page, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_events_autobump ON public.lead_events;
CREATE TRIGGER trg_lead_events_autobump
  AFTER INSERT ON public.lead_events
  FOR EACH ROW
  EXECUTE FUNCTION public.lead_events_autobump();