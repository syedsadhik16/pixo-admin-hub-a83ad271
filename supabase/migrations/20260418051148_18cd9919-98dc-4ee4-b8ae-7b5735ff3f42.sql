-- Seed parent profiles + parent_children links + add entitlement expiry dates
-- Idempotent: ON CONFLICT DO NOTHING / WHERE NOT EXISTS

-- Insert parent profiles for 3 parents (using deterministic UUIDs)
INSERT INTO profiles (id, email, full_name, is_active)
VALUES 
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'priya.parent@example.com', 'Priya Sharma',  true),
  ('f0000000-0000-0000-0000-000000000002'::uuid, 'rajesh.parent@example.com', 'Rajesh Singh', true),
  ('f0000000-0000-0000-0000-000000000003'::uuid, 'meera.parent@example.com', 'Meera Joshi',   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parent_profiles (user_id, relationship_label)
SELECT id, 'parent' FROM profiles 
WHERE id IN (
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'f0000000-0000-0000-0000-000000000003'::uuid
)
AND NOT EXISTS (SELECT 1 FROM parent_profiles pp WHERE pp.user_id = profiles.id);

-- Link parents to students
INSERT INTO parent_children (parent_user_id, student_user_id, relation_type, status)
VALUES
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, 'mother', 'active'),
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000002'::uuid, 'mother', 'active'),
  ('f0000000-0000-0000-0000-000000000002'::uuid, 'e1000000-0000-0000-0000-000000000004'::uuid, 'father', 'active'),
  ('f0000000-0000-0000-0000-000000000003'::uuid, 'e1000000-0000-0000-0000-000000000006'::uuid, 'mother', 'active'),
  ('f0000000-0000-0000-0000-000000000003'::uuid, 'e1000000-0000-0000-0000-000000000007'::uuid, 'mother', 'active')
ON CONFLICT DO NOTHING;

-- Set realistic expiry dates on existing entitlements (only where null)
UPDATE user_entitlements
SET valid_from = COALESCE(valid_from, NOW() - (random() * INTERVAL '60 days')),
    valid_until = NOW() + (random() * INTERVAL '180 days'),
    plan_duration_months = COALESCE(plan_duration_months, 6)
WHERE valid_until IS NULL;

-- Add a few free + expired + trial entitlements for filter coverage
INSERT INTO user_entitlements (user_id, plan_name, payment_status, is_active, plan_duration_months, valid_from, valid_until)
SELECT user_id, 'free', 'free', true, 0, NOW() - INTERVAL '10 days', NULL
FROM student_profiles sp
WHERE NOT EXISTS (SELECT 1 FROM user_entitlements ue WHERE ue.user_id = sp.user_id)
LIMIT 5;

INSERT INTO user_entitlements (user_id, plan_name, payment_status, is_active, plan_duration_months, valid_from, valid_until)
VALUES
  ('e1000000-0000-0000-0000-000000000010'::uuid, 'trial',   'trial',   true,  0, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days'),
  ('e1000000-0000-0000-0000-000000000011'::uuid, 'expired', 'expired', false, 1, NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;