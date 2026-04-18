
CREATE TABLE IF NOT EXISTS public.b2b_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  seats integer NOT NULL DEFAULT 0,
  plan text DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage b2b orgs"
  ON public.b2b_organizations FOR ALL
  USING (public.is_admin_or_founder(auth.uid()))
  WITH CHECK (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Staff view b2b orgs"
  ON public.b2b_organizations FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_b2b_orgs_updated_at
  BEFORE UPDATE ON public.b2b_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS b2b_org_id uuid REFERENCES public.b2b_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_profiles_b2b_org ON public.student_profiles(b2b_org_id);
