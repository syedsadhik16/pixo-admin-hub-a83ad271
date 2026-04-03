
-- Role enum
CREATE TYPE public.app_role AS ENUM ('student', 'parent', 'admin', 'founder', 'staff_support', 'staff_sales', 'staff_content');

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User roles table (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Student profiles
CREATE TABLE public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  age int,
  grade text,
  school_board text,
  current_level text,
  onboarding_completed boolean DEFAULT false,
  active_plan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Parent profiles
CREATE TABLE public.parent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relationship_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Parent-children linking
CREATE TABLE public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relation_type text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_link CHECK (parent_user_id != student_user_id)
);

-- Staff members
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  staff_role text,
  department text,
  permissions jsonb DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id),
  active_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Role permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module_key text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_publish boolean DEFAULT false
);

-- Curriculum levels
CREATE TABLE public.curriculum_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_key text UNIQUE NOT NULL,
  title text NOT NULL,
  age_range text,
  display_order int,
  is_active boolean DEFAULT true
);

-- Curriculum weeks
CREATE TABLE public.curriculum_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid REFERENCES public.curriculum_levels(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  title text,
  objective text,
  reward_label text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Curriculum days
CREATE TABLE public.curriculum_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid REFERENCES public.curriculum_levels(id),
  week_id uuid REFERENCES public.curriculum_weeks(id),
  day_number int NOT NULL,
  title text,
  theme text,
  objective text,
  xp_reward int DEFAULT 0,
  badge_label text,
  is_free boolean DEFAULT false,
  is_published boolean DEFAULT false,
  version_number int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Curriculum day parts
CREATE TABLE public.curriculum_day_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES public.curriculum_days(id) ON DELETE CASCADE,
  part_number int NOT NULL,
  title text,
  duration_minutes int,
  skill_focus text,
  instructions text,
  activity_type text,
  content_json jsonb DEFAULT '{}',
  media_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Student progress
CREATE TABLE public.student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_level text,
  current_day int DEFAULT 1,
  completed_days int DEFAULT 0,
  streak_count int DEFAULT 0,
  confidence_score numeric DEFAULT 0,
  fluency_score numeric DEFAULT 0,
  accuracy_score numeric DEFAULT 0,
  engagement_score numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- User entitlements
CREATE TABLE public.user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name text,
  plan_duration_months int,
  payment_status text,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Payment orders
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id text UNIQUE,
  amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  plan_name text,
  receipt text,
  status text DEFAULT 'created',
  notes jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment transactions
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id text,
  payment_id text,
  signature text,
  amount numeric,
  payment_method text,
  status text,
  failure_reason text,
  invoice_url text,
  created_at timestamptz DEFAULT now()
);

-- AI behavior settings
CREATE TABLE public.ai_behavior_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona text,
  correction_mode text,
  confidence_priority boolean DEFAULT true,
  max_corrections int DEFAULT 3,
  accuracy_strictness int DEFAULT 5,
  system_prompt text,
  preview_prompt text,
  is_active boolean DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Feature flags
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text UNIQUE NOT NULL,
  flag_value boolean DEFAULT false,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- UI config
CREATE TABLE public.ui_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Parent connect settings
CREATE TABLE public.parent_connect_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visibility_flags jsonb DEFAULT '{}',
  intervention_enabled boolean DEFAULT false,
  ai_tone text DEFAULT 'empowering',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- App versions
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name text NOT NULL,
  environment text,
  release_notes text,
  deployed_by uuid REFERENCES auth.users(id),
  deployed_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT false
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_role text,
  module_key text,
  action_type text NOT NULL,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- System sync logs
CREATE TABLE public.system_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text,
  status text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Learner parent outputs
CREATE TABLE public.learner_parent_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  summary_json jsonb DEFAULT '{}',
  visible_insights jsonb DEFAULT '{}',
  ai_tone text,
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- SECURITY DEFINER FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_founder(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'founder')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'founder', 'staff_support', 'staff_sales', 'staff_content')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_children
    WHERE parent_user_id = _parent_id AND student_user_id = _child_id AND status = 'active'
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parent_profiles_updated_at BEFORE UPDATE ON public.parent_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_curriculum_weeks_updated_at BEFORE UPDATE ON public.curriculum_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_curriculum_days_updated_at BEFORE UPDATE ON public.curriculum_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_curriculum_day_parts_updated_at BEFORE UPDATE ON public.curriculum_day_parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_day_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_behavior_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_connect_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_parent_outputs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin/founder can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin/founder can manage all roles" ON public.user_roles FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Anyone can insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Student profiles
CREATE POLICY "Students can view own" ON public.student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Parents can view linked children" ON public.student_profiles FOR SELECT USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "Admin can view all students" ON public.student_profiles FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff can view all students" ON public.student_profiles FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Students can insert own" ON public.student_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students can update own" ON public.student_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Parent profiles
CREATE POLICY "Parents can view own" ON public.parent_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all parents" ON public.parent_profiles FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Parents can insert own" ON public.parent_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Parents can update own" ON public.parent_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Parent children
CREATE POLICY "Parents can view own links" ON public.parent_children FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Students can view own links" ON public.parent_children FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Admin can view all links" ON public.parent_children FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Parents can create links" ON public.parent_children FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "Admin can manage all links" ON public.parent_children FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Staff members
CREATE POLICY "Admin/founder can manage staff" ON public.staff_members FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff can view own" ON public.staff_members FOR SELECT USING (auth.uid() = user_id);

-- Role permissions
CREATE POLICY "Admin/founder can manage permissions" ON public.role_permissions FOR ALL USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Staff can view permissions" ON public.role_permissions FOR SELECT USING (public.is_staff(auth.uid()));

-- Curriculum tables (public read for published, admin manage)
CREATE POLICY "Anyone can read active levels" ON public.curriculum_levels FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage levels" ON public.curriculum_levels FOR ALL USING (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Anyone can read published weeks" ON public.curriculum_weeks FOR SELECT USING (is_published = true);
CREATE POLICY "Admin can manage weeks" ON public.curriculum_weeks FOR ALL USING (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Anyone can read published days" ON public.curriculum_days FOR SELECT USING (is_published = true);
CREATE POLICY "Admin can manage days" ON public.curriculum_days FOR ALL USING (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Anyone can read day parts of published days" ON public.curriculum_day_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.curriculum_days WHERE id = day_id AND is_published = true)
);
CREATE POLICY "Admin can manage day parts" ON public.curriculum_day_parts FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Student progress
CREATE POLICY "Students can view own progress" ON public.student_progress FOR SELECT USING (auth.uid() = student_user_id);
CREATE POLICY "Parents can view linked child progress" ON public.student_progress FOR SELECT USING (public.is_parent_of(auth.uid(), student_user_id));
CREATE POLICY "Admin can view all progress" ON public.student_progress FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Students can manage own progress" ON public.student_progress FOR INSERT WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Students can update own progress" ON public.student_progress FOR UPDATE USING (auth.uid() = student_user_id);

-- Entitlements
CREATE POLICY "Users can view own entitlements" ON public.user_entitlements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage entitlements" ON public.user_entitlements FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Payment orders
CREATE POLICY "Users can view own orders" ON public.payment_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON public.payment_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all orders" ON public.payment_orders FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Payment transactions
CREATE POLICY "Users can view own transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all transactions" ON public.payment_transactions FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- AI behavior settings (admin only manage, app can read active)
CREATE POLICY "Anyone can read active AI settings" ON public.ai_behavior_settings FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage AI settings" ON public.ai_behavior_settings FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Feature flags
CREATE POLICY "Anyone can read feature flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage feature flags" ON public.feature_flags FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- UI config
CREATE POLICY "Anyone can read UI config" ON public.ui_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage UI config" ON public.ui_config FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Parent connect settings
CREATE POLICY "Anyone can read parent connect settings" ON public.parent_connect_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage parent connect settings" ON public.parent_connect_settings FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- App versions
CREATE POLICY "Anyone can read active versions" ON public.app_versions FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage versions" ON public.app_versions FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- Audit logs (immutable, admin/founder read)
CREATE POLICY "Admin can read audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- System sync logs
CREATE POLICY "Admin can read sync logs" ON public.system_sync_logs FOR SELECT USING (public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Admin can insert sync logs" ON public.system_sync_logs FOR INSERT WITH CHECK (public.is_admin_or_founder(auth.uid()));

-- Learner parent outputs
CREATE POLICY "Parents can view linked child outputs" ON public.learner_parent_outputs FOR SELECT USING (public.is_parent_of(auth.uid(), student_user_id));
CREATE POLICY "Admin can manage outputs" ON public.learner_parent_outputs FOR ALL USING (public.is_admin_or_founder(auth.uid()));

-- ==========================================
-- STORAGE BUCKETS
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('curriculum-media', 'curriculum-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('student-uploads', 'student-uploads', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-exports', 'admin-exports', false);

-- Storage policies
CREATE POLICY "Public read curriculum media" ON storage.objects FOR SELECT USING (bucket_id = 'curriculum-media');
CREATE POLICY "Admin manage curriculum media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'curriculum-media' AND public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Admin update curriculum media" ON storage.objects FOR UPDATE USING (bucket_id = 'curriculum-media' AND public.is_admin_or_founder(auth.uid()));
CREATE POLICY "Admin delete curriculum media" ON storage.objects FOR DELETE USING (bucket_id = 'curriculum-media' AND public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Public read brand assets" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY "Admin manage brand assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brand-assets' AND public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Users read own invoices" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admin read all invoices" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Students upload own files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Students read own files" ON storage.objects FOR SELECT USING (bucket_id = 'student-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin manage exports" ON storage.objects FOR ALL USING (bucket_id = 'admin-exports' AND public.is_admin_or_founder(auth.uid()));
