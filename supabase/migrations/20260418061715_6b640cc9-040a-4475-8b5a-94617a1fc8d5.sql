-- Employee profiles
CREATE TABLE public.employee_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'sales',
  joining_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage employees"
  ON public.employee_profiles
  FOR ALL
  USING (public.is_admin_or_founder(auth.uid()))
  WITH CHECK (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Staff view employees"
  ON public.employee_profiles
  FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_employee_profiles_updated_at
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sales transactions
CREATE TABLE public.sales_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  order_id TEXT,
  plan_name TEXT,
  plan_amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage sales transactions"
  ON public.sales_transactions
  FOR ALL
  USING (public.is_admin_or_founder(auth.uid()))
  WITH CHECK (public.is_admin_or_founder(auth.uid()));

CREATE POLICY "Staff view sales transactions"
  ON public.sales_transactions
  FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_sales_transactions_employee ON public.sales_transactions(employee_id);
CREATE INDEX idx_sales_transactions_user ON public.sales_transactions(user_id);
CREATE INDEX idx_sales_transactions_created ON public.sales_transactions(created_at DESC);

-- Commission calculator
CREATE OR REPLACE FUNCTION public.calc_commission(_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _amount >= 14999 THEN 2000
    WHEN _amount >= 9999 THEN 1500
    WHEN _amount >= 5999 THEN 1000
    ELSE 0
  END;
$$;

-- Auto-fill commission on insert if zero
CREATE OR REPLACE FUNCTION public.sales_transactions_autofill()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_amount IS NULL OR NEW.commission_amount = 0 THEN
    NEW.commission_amount := public.calc_commission(NEW.plan_amount);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_transactions_autofill
  BEFORE INSERT ON public.sales_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sales_transactions_autofill();