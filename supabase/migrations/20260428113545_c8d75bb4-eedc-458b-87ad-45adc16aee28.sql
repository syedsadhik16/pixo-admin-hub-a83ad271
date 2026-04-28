
-- 1. Employee category + designation columns
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS designation text;

-- 2. is_admin_founder_or_hr helper (extends existing is_admin_or_founder to include HR)
CREATE OR REPLACE FUNCTION public.can_invite_employees(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','founder')
  ) OR EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE LOWER(role) IN ('hr','admin','founder')
      AND status = 'active'
      AND id IN (
        SELECT id FROM public.employee_profiles
        WHERE email = (SELECT email FROM auth.users WHERE id = _user_id LIMIT 1)
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_invite_employees(uuid) TO authenticated;

-- 3. employee_invites table
CREATE TABLE IF NOT EXISTS public.employee_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('office','commission')),
  designation text,
  preset_role text,
  preset_employee_code text,
  invited_email text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by_user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','revoked'))
);

CREATE INDEX IF NOT EXISTS idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX IF NOT EXISTS idx_employee_invites_status ON public.employee_invites(status);

ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

-- Admin/founder/HR can create invites
CREATE POLICY "Authorized can create invites"
ON public.employee_invites FOR INSERT
TO authenticated
WITH CHECK (can_invite_employees(auth.uid()) AND created_by = auth.uid());

-- Admin/founder/HR can read all invites (to manage them)
CREATE POLICY "Authorized can view invites"
ON public.employee_invites FOR SELECT
TO authenticated
USING (can_invite_employees(auth.uid()));

-- Admin/founder can update (revoke) invites
CREATE POLICY "Admin can update invites"
ON public.employee_invites FOR UPDATE
TO authenticated
USING (is_admin_or_founder(auth.uid()));

-- Admin/founder can delete invites
CREATE POLICY "Admin can delete invites"
ON public.employee_invites FOR DELETE
TO authenticated
USING (is_admin_or_founder(auth.uid()));
