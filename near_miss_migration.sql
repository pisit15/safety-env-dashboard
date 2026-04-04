-- Near Miss Report Migration
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS near_miss_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_no text UNIQUE,                    -- e.g. NM-20260404-001

  -- Section A: Reporter info
  company_id text NOT NULL,
  reporter_name text NOT NULL,
  reporter_dept text,
  incident_date date NOT NULL,
  location text NOT NULL,

  -- Section B: What happened
  incident_description text NOT NULL,

  -- Section C: Saving factor
  saving_factor text,

  -- Section D: Risk assessment
  probability integer CHECK (probability BETWEEN 1 AND 5),
  severity integer CHECK (severity BETWEEN 1 AND 5),
  risk_score integer GENERATED ALWAYS AS (probability * severity) STORED,
  risk_level text GENERATED ALWAYS AS (
    CASE
      WHEN (probability * severity) >= 15 THEN 'HIGH'
      WHEN (probability * severity) >= 9  THEN 'MED-HIGH'
      WHEN (probability * severity) >= 4  THEN 'MEDIUM'
      ELSE 'LOW'
    END
  ) STORED,

  -- Section E: Actions
  immediate_action text,
  responsible_person text,
  due_date date,

  -- Admin fields (only editable by admin)
  status text DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'action_taken', 'closed')),
  investigation_level text,
  safety_officer text,
  closed_date date,
  admin_notes text,

  -- Bot protection / metadata
  submitter_ip text,
  form_duration_ms integer,   -- time spent on form in ms

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-increment report_no per company per day
CREATE OR REPLACE FUNCTION generate_report_no()
RETURNS TRIGGER AS $$
DECLARE
  date_str text;
  seq integer;
BEGIN
  date_str := to_char(NEW.incident_date, 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq
  FROM near_miss_reports
  WHERE company_id = NEW.company_id
    AND to_char(incident_date, 'YYYYMMDD') = date_str;
  NEW.report_no := 'NM-' || date_str || '-' || LPAD(seq::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_no
  BEFORE INSERT ON near_miss_reports
  FOR EACH ROW
  WHEN (NEW.report_no IS NULL)
  EXECUTE FUNCTION generate_report_no();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_nearmiss_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nearmiss_updated_at
  BEFORE UPDATE ON near_miss_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_nearmiss_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nearmiss_company ON near_miss_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_nearmiss_status ON near_miss_reports(status);
CREATE INDEX IF NOT EXISTS idx_nearmiss_created ON near_miss_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nearmiss_incident_date ON near_miss_reports(incident_date DESC);

-- IP rate limiting table
CREATE TABLE IF NOT EXISTS nearmiss_ip_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  company_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iplog_ip_time ON nearmiss_ip_log(ip, created_at DESC);

-- Disable RLS (internal dashboard)
ALTER TABLE near_miss_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE nearmiss_ip_log DISABLE ROW LEVEL SECURITY;
