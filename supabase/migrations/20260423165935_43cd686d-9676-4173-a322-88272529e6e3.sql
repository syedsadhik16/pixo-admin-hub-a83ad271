-- =========================================================
-- PHASE 1: Extend Admin Hub schema for Parent Link unification
-- All "child" references map to student_profiles.user_id (auth.users.id)
-- =========================================================

-- ---------- 1. attendance_records ----------
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL,
  minutes_attended INTEGER,
  class_type TEXT,
  session_title TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_user_id);
CREATE INDEX idx_attendance_date ON public.attendance_records(attendance_date);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage attendance" ON public.attendance_records
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view attendance" ON public.attendance_records
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own attendance" ON public.attendance_records
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child attendance" ON public.attendance_records
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 2. child_schedule ----------
CREATE TABLE public.child_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  curriculum_day_id UUID NOT NULL REFERENCES public.curriculum_days(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  class_status TEXT NOT NULL DEFAULT 'scheduled',
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedule_student ON public.child_schedule(student_user_id);
CREATE INDEX idx_schedule_date ON public.child_schedule(scheduled_date);
ALTER TABLE public.child_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage schedule" ON public.child_schedule
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view schedule" ON public.child_schedule
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own schedule" ON public.child_schedule
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child schedule" ON public.child_schedule
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 3. lesson_activity ----------
CREATE TABLE public.lesson_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  score NUMERIC,
  lesson_day INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_activity_student ON public.lesson_activity(student_user_id);
CREATE INDEX idx_lesson_activity_date ON public.lesson_activity(activity_date);
ALTER TABLE public.lesson_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage lesson activity" ON public.lesson_activity
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view lesson activity" ON public.lesson_activity
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students manage own lesson activity" ON public.lesson_activity
  FOR INSERT WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Students view own lesson activity" ON public.lesson_activity
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child lesson activity" ON public.lesson_activity
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 4. monthly_reports ----------
CREATE TABLE public.monthly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  month_label TEXT NOT NULL,
  summary TEXT,
  attendance_percentage NUMERIC,
  lessons_completed INTEGER,
  strengths JSONB DEFAULT '[]'::jsonb,
  improvement_areas JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  premium_insights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monthly_reports_student ON public.monthly_reports(student_user_id);
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage monthly reports" ON public.monthly_reports
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view monthly reports" ON public.monthly_reports
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own monthly reports" ON public.monthly_reports
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child monthly reports" ON public.monthly_reports
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 5. weekly_reports ----------
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  week_label TEXT NOT NULL,
  summary TEXT,
  confidence_note TEXT,
  report_status TEXT DEFAULT 'draft',
  strengths JSONB DEFAULT '[]'::jsonb,
  improvement_areas JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  premium_insights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_weekly_reports_student ON public.weekly_reports(student_user_id);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage weekly reports" ON public.weekly_reports
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view weekly reports" ON public.weekly_reports
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own weekly reports" ON public.weekly_reports
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child weekly reports" ON public.weekly_reports
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 6. performance_snapshots ----------
CREATE TABLE public.performance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  period_type TEXT NOT NULL,
  attendance_percentage NUMERIC,
  fluency_score NUMERIC,
  phonics_score NUMERIC,
  pronunciation_score NUMERIC,
  vocabulary_score NUMERIC,
  confidence_score NUMERIC,
  lessons_completed INTEGER,
  reading_sessions INTEGER,
  speaking_attempts INTEGER,
  time_spent_minutes INTEGER,
  weak_words JSONB DEFAULT '[]'::jsonb,
  weak_sounds JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_perf_snap_student ON public.performance_snapshots(student_user_id);
CREATE INDEX idx_perf_snap_date ON public.performance_snapshots(snapshot_date);
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage perf snapshots" ON public.performance_snapshots
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view perf snapshots" ON public.performance_snapshots
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own perf snapshots" ON public.performance_snapshots
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child perf snapshots" ON public.performance_snapshots
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 7. parent_notifications ----------
CREATE TABLE public.parent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL,
  student_user_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,
  notification_type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parent_notif_parent ON public.parent_notifications(parent_user_id);
CREATE INDEX idx_parent_notif_unread ON public.parent_notifications(parent_user_id, read) WHERE read = false;
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage parent notifications" ON public.parent_notifications
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view parent notifications" ON public.parent_notifications
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Parents view own notifications" ON public.parent_notifications
  FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents update own notifications" ON public.parent_notifications
  FOR UPDATE USING (auth.uid() = parent_user_id);

-- ---------- 8. subscriptions ----------
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active',
  payment_status TEXT,
  is_premium BOOLEAN DEFAULT false,
  billing_cycle_months INTEGER,
  level_access JSONB DEFAULT '[]'::jsonb,
  start_date DATE,
  expiry_date DATE,
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_student ON public.subscriptions(student_user_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage subscriptions" ON public.subscriptions
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view subscriptions" ON public.subscriptions
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child subscription" ON public.subscriptions
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 9. billing_history ----------
CREATE TABLE public.billing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT,
  payment_provider TEXT,
  payment_date TIMESTAMPTZ,
  invoice_number TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_student ON public.billing_history(student_user_id);
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage billing history" ON public.billing_history
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view billing history" ON public.billing_history
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Students view own billing" ON public.billing_history
  FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents view linked child billing" ON public.billing_history
  FOR SELECT USING (is_parent_of(auth.uid(), student_user_id));

-- ---------- 10. support_requests ----------
CREATE TABLE public.support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL,
  student_user_id UUID,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  issue_type TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_parent ON public.support_requests(parent_user_id);
CREATE INDEX idx_support_status ON public.support_requests(status);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage support requests" ON public.support_requests
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff view support requests" ON public.support_requests
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Parents create own support requests" ON public.support_requests
  FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "Parents view own support requests" ON public.support_requests
  FOR SELECT USING (auth.uid() = parent_user_id);

-- ---------- 11. app_settings (global config kv-store) ----------
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage app settings" ON public.app_settings
  FOR ALL USING (is_admin_or_founder(auth.uid())) WITH CHECK (is_admin_or_founder(auth.uid()));
CREATE POLICY "Authenticated read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();