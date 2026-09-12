INSERT INTO profiles (id, role, full_name, phone, email, location, is_available)
VALUES
  ('gov-demo-1', 'government', 'Disaster Control Center', '+94770000001', 'gov@crisisconnect.demo', ST_GeogFromText('POINT(79.8612 6.9271)'), true),
  ('ngo-demo-1', 'ngo_org_member', 'Ayesha Perera', '+94770000002', 'ayesha@ngo.demo', ST_GeogFromText('POINT(79.8700 6.9300)'), true),
  ('ngo-demo-2', 'ngo_individual', 'Ruwan Silva', '+94770000003', 'ruwan@ngo.demo', ST_GeogFromText('POINT(79.8760 6.9350)'), true),
  ('citizen-demo-1', 'citizen', 'Nuwan Dhananjaya', '+94769635843', 'nuwan@demo.com', ST_GeogFromText('POINT(79.8685 6.9240)'), true),
  ('citizen-demo-2', 'citizen', 'Sahas Eashan', '+94776413121', 'sahas@demo.com', ST_GeogFromText('POINT(79.8820 6.9400)'), true),
  ('citizen-demo-3', 'citizen', 'Himeth Walgampaya', '+94742885820', 'himeth@demo.com', ST_GeogFromText('POINT(79.8740 6.9365)'), true)
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    location = EXCLUDED.location,
    is_available = EXCLUDED.is_available;

INSERT INTO organizations (id, name, type, description, approval_status, approved_by, created_by)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Rapid Relief Lanka', 'ngo', 'Urban flood response specialists', 'approved', 'gov-demo-1', 'ngo-demo-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_members (org_id, user_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ngo-demo-1', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'ngo-demo-2', 'member')
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO disasters (id, title, description, type, severity, status, affected_area, center_point, radius_km, secondary_risks, created_by)
VALUES
  (
    '22222222-2222-2222-2222-222222222222',
    'Colombo Urban Flood',
    'Heavy rainfall has submerged low-lying roads and neighborhoods.',
    'flood',
    'high',
    'active',
    ST_GeogFromText('POLYGON((79.8510 6.9150,79.8910 6.9150,79.8910 6.9490,79.8510 6.9490,79.8510 6.9150))'),
    ST_GeogFromText('POINT(79.8710 6.9320)'),
    5,
    ARRAY['water contamination', 'disease outbreak'],
    'gov-demo-1'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO safe_zones (id, name, location, boundary, capacity, current_occupancy, amenities, disaster_id, status, created_by)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    'Independence Hall Shelter',
    ST_GeogFromText('POINT(79.8671 6.9049)'),
    ST_GeogFromText('POLYGON((79.8660 6.9040,79.8680 6.9040,79.8680 6.9060,79.8660 6.9060,79.8660 6.9040))'),
    500,
    180,
    ARRAY['medical', 'food', 'charging'],
    '22222222-2222-2222-2222-222222222222',
    'active',
    'gov-demo-1'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Sugathadasa Indoor Camp',
    ST_GeogFromText('POINT(79.8778 6.9492)'),
    ST_GeogFromText('POLYGON((79.8768 6.9482,79.8788 6.9482,79.8788 6.9502,79.8768 6.9502,79.8768 6.9482))'),
    650,
    420,
    ARRAY['beds', 'medical', 'water'],
    '22222222-2222-2222-2222-222222222222',
    'active',
    'gov-demo-1'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO resources (id, name, category, quantity, unit, status, location, managed_by, org_id, disaster_id)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'Bottled Water Packs', 'water', 700, 'packs', 'available', ST_GeogFromText('POINT(79.8730 6.9285)'), 'ngo-demo-1', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('66666666-6666-6666-6666-666666666666', 'First Aid Kits', 'medical', 80, 'kits', 'low', ST_GeogFromText('POINT(79.8695 6.9358)'), 'ngo-demo-2', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resource_requests (id, requested_by, resource_name, quantity_needed, urgency, status, location)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'citizen-demo-1', 'Dry food packs', 20, 'high', 'pending', ST_GeogFromText('POINT(79.8685 6.9240)'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO sos_signals (id, sender_id, location, type, description, status, assigned_to, disaster_id)
VALUES
  ('88888888-8888-8888-8888-888888888888', 'citizen-demo-2', ST_GeogFromText('POINT(79.8820 6.9400)'), 'evacuation', 'Family trapped on second floor, rising water level.', 'assigned', 'ngo-demo-1', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO news_updates (id, title, content, category, disaster_id, author_id)
VALUES
  ('99999999-9999-9999-9999-999999999999', 'Road Closures in Colombo 07', 'Ward Place and surrounding roads are temporarily closed. Use alternate safe-zone routes shown in the app.', 'transport', '22222222-2222-2222-2222-222222222222', 'gov-demo-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_aid (id, disaster_id, amount, currency, source, allocated_to, status, notes, created_by)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 1500000, 'LKR', 'Emergency Treasury Allocation', '11111111-1111-1111-1111-111111111111', 'allocated', 'Initial flood response budget.', 'gov-demo-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_audit_logs (id, action, role, user_id, model, status, review_status, confidence, source_ids, warnings, created_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'generateIncidentBrief', 'government', 'gov-demo-1', 'gemini-2.5-pro', 'completed', 'approved', 0.84, ARRAY['22222222-2222-2222-2222-222222222222'], ARRAY['Human-reviewed in demo environment.'], now() - interval '15 minutes'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'triageSosCase', 'ngo', 'ngo-demo-1', 'gemini-2.5-flash', 'completed', 'pending_review', 0.80, ARRAY['88888888-8888-8888-8888-888888888888'], ARRAY['Responder assignment still requires operator confirmation.'], now() - interval '5 minutes')
ON CONFLICT (id) DO NOTHING;
