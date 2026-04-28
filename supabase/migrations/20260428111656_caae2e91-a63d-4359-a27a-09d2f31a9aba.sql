-- Enable realtime broadcast for tables the Leads page subscribes to.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.lead_events REPLICA IDENTITY FULL;
ALTER TABLE public.lead_pipeline REPLICA IDENTITY FULL;
ALTER TABLE public.payment_funnel_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_pipeline; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_funnel_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;