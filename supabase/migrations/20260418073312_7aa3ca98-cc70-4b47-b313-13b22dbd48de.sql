INSERT INTO public.employee_profiles (employee_code, name, email, role, status)
VALUES 
  ('EMP-ADMIN-001', 'Pixo Admin', 'admin@pixo.ai', 'admin', 'active'),
  ('EMP-FOUNDER-001', 'Pixo Founder', 'founder@pixo.ai', 'admin', 'active')
ON CONFLICT (employee_code) DO UPDATE SET role = EXCLUDED.role, status = 'active', email = EXCLUDED.email;