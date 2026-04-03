-- Enable realtime on tables needed for Dashboard and Payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_entitlements;