CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('citizen', 'ngo_individual', 'ngo_org_member', 'government');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disaster_severity') THEN
    CREATE TYPE disaster_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disaster_status') THEN
    CREATE TYPE disaster_status AS ENUM ('active', 'monitoring', 'resolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sos_status') THEN
    CREATE TYPE sos_status AS ENUM ('pending', 'assigned', 'in_progress', 'resolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_status') THEN
    CREATE TYPE resource_status AS ENUM ('available', 'low', 'depleted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_approval') THEN
    CREATE TYPE org_approval AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'citizen',
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  location GEOGRAPHY(POINT, 4326),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  approval_status org_approval DEFAULT 'pending',
  approved_by TEXT REFERENCES profiles(id),
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id),
  role TEXT DEFAULT 'member',
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  severity disaster_severity NOT NULL,
  status disaster_status DEFAULT 'active',
  affected_area GEOGRAPHY(POLYGON, 4326),
  center_point GEOGRAPHY(POINT, 4326),
  radius_km NUMERIC,
  secondary_risks TEXT[],
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  boundary GEOGRAPHY(POLYGON, 4326),
  capacity INTEGER NOT NULL,
  current_occupancy INTEGER DEFAULT 0,
  amenities TEXT[],
  disaster_id UUID REFERENCES disasters(id),
  status TEXT DEFAULT 'active',
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER,
  unit TEXT,
  status resource_status DEFAULT 'available',
  location GEOGRAPHY(POINT, 4326),
  managed_by TEXT REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  disaster_id UUID REFERENCES disasters(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by TEXT REFERENCES profiles(id),
  resource_id UUID REFERENCES resources(id),
  resource_name TEXT,
  quantity_needed INTEGER,
  urgency TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  fulfilled_by TEXT REFERENCES profiles(id),
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sos_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT REFERENCES profiles(id),
  location GEOGRAPHY(POINT, 4326),
  type TEXT,
  description TEXT,
  status sos_status DEFAULT 'pending',
  assigned_to TEXT REFERENCES profiles(id),
  disaster_id UUID REFERENCES disasters(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT,
  channel TEXT[],
  target_area GEOGRAPHY(POLYGON, 4326),
  target_roles user_role[],
  disaster_id UUID REFERENCES disasters(id),
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  disaster_id UUID REFERENCES disasters(id),
  author_id TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_aid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID REFERENCES disasters(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'LKR',
  source TEXT,
  allocated_to UUID REFERENCES organizations(id),
  status TEXT DEFAULT 'allocated',
  notes TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  role TEXT NOT NULL,
  user_id TEXT REFERENCES profiles(id),
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  review_status TEXT DEFAULT 'pending_review',
  confidence NUMERIC,
  source_ids TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  blocked BOOLEAN DEFAULT false,
  pii_detected BOOLEAN DEFAULT false,
  prompt_injection_risk BOOLEAN DEFAULT false,
  unsafe_content BOOLEAN DEFAULT false,
  reasons TEXT[] DEFAULT '{}',
  latency_ms INTEGER,
  token_usage INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
 );

CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_disasters_affected_area ON disasters USING GIST (affected_area);
CREATE INDEX IF NOT EXISTS idx_safe_zones_location ON safe_zones USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_resources_location ON resources USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_sos_location ON sos_signals USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_disasters_status ON disasters (status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests (status);
CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_signals (status);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_time ON ai_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_action_time ON ai_audit_logs (action, created_at DESC);
