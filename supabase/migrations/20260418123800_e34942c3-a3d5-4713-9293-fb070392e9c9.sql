-- Reconcile lead_pipeline.stage allowed values with the auto-classification trigger.
-- Trigger writes: cold, warm, hot, converted, dropped.
-- Old check accidentally allowed: cold, warm, hot, subscribed, inactive, dropped (mismatch broke trigger inserts).
ALTER TABLE public.lead_pipeline DROP CONSTRAINT IF EXISTS lead_pipeline_stage_check;
ALTER TABLE public.lead_pipeline
  ADD CONSTRAINT lead_pipeline_stage_check
  CHECK (stage = ANY (ARRAY['cold','warm','hot','converted','dropped']));

-- Helpful indexes for the live admin queries.
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON public.lead_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON public.lead_events (event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_user_id ON public.lead_events (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_funnel_created_at ON public.payment_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_stage ON public.lead_pipeline (stage);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_last_activity ON public.lead_pipeline (last_activity_at DESC);