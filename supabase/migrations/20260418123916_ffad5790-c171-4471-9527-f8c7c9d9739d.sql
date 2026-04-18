-- Allow both the legacy richer vocabulary and the simpler one used by trackPaymentFunnel().
ALTER TABLE public.payment_funnel_events DROP CONSTRAINT IF EXISTS payment_funnel_events_event_type_check;
ALTER TABLE public.payment_funnel_events
  ADD CONSTRAINT payment_funnel_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    -- simple set (used by trackPaymentFunnel + admin UI)
    'page_view','initiated','success','failed',
    -- legacy richer set (kept for backward compat)
    'parent_linked','pricing_visited','payment_initiated','payment_page_entered','payment_success','payment_failed','subscription_activated'
  ]));