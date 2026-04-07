-- =============================================
-- SHE Workforce / Manpower Efficiency Tables
-- =============================================

-- 1. SHE Personnel — individual team members
CREATE TABLE IF NOT EXISTS she_personnel (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  bu text DEFAULT '',                    -- Business Unit (HO, Biodiesel, EV, etc.)
  full_name text NOT NULL,               -- ชื่อ-นามสกุล
  nick_name text DEFAULT '',
  position text DEFAULT '',              -- ตำแหน่ง (HSE Manager, จป.วิชาชีพ, etc.)
  responsibility text DEFAULT '',        -- หน้าที่หลัก (Safety, Environment, OH)
  department text DEFAULT 'HSE',
  employment_type text DEFAULT 'permanent', -- permanent|subcontract|outsource|part_time|dvt
  phone text DEFAULT '',
  email text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_she_personnel_company ON she_personnel(company_id);
CREATE INDEX IF NOT EXISTS idx_she_personnel_active ON she_personnel(company_id, is_active);

-- 2. Legal Requirement Types — configurable per company
-- (จป.วิชาชีพ, จป.เทคนิค, คปอ., ผู้ควบคุมมลพิษน้ำ, etc.)
CREATE TABLE IF NOT EXISTS legal_requirement_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  name text NOT NULL,                    -- e.g. "เจ้าหน้าที่ความปลอดภัยระดับวิชาชีพ"
  short_name text NOT NULL,              -- e.g. "จป.วิชาชีพ"
  category text DEFAULT 'safety',        -- safety | environment | health
  required_count integer DEFAULT 0,      -- จำนวนที่กฎหมายกำหนด (0 = ไม่กำหนด, คำนวณจากพนักงาน)
  description text DEFAULT '',
  law_reference text DEFAULT '',         -- อ้างอิงกฎหมาย
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_req_types_company ON legal_requirement_types(company_id);

-- 3. Personnel × License mapping — who holds what license
CREATE TABLE IF NOT EXISTS personnel_licenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id uuid NOT NULL REFERENCES she_personnel(id) ON DELETE CASCADE,
  requirement_type_id uuid NOT NULL REFERENCES legal_requirement_types(id) ON DELETE CASCADE,
  has_license boolean DEFAULT false,
  license_no text DEFAULT '',
  issue_date date,
  expiry_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(personnel_id, requirement_type_id)
);

CREATE INDEX IF NOT EXISTS idx_personnel_licenses_personnel ON personnel_licenses(personnel_id);
CREATE INDEX IF NOT EXISTS idx_personnel_licenses_req ON personnel_licenses(requirement_type_id);

-- 4. Workload entries — job analysis per person/role
CREATE TABLE IF NOT EXISTS she_workload (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  personnel_id uuid REFERENCES she_personnel(id) ON DELETE SET NULL,
  function_name text DEFAULT '',         -- e.g. "Safety & Health"
  job_level1 text DEFAULT '',            -- หัวข้องานหลัก
  job_level2 text DEFAULT '',            -- ฟังก์ชั่นย่อย
  job_level3 text DEFAULT '',            -- รายละเอียด
  job_rank text DEFAULT 'B',             -- A|B|C (skill level)
  job_type text DEFAULT 'fixed',         -- fixed|variable
  time_usage_min integer DEFAULT 0,      -- เวลาต่อครั้ง (นาที)
  frequency text DEFAULT 'daily',        -- daily|weekly|monthly|yearly
  frequency_count integer DEFAULT 1,     -- จำนวนครั้ง
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_she_workload_company ON she_workload(company_id);

-- Enable RLS
ALTER TABLE she_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_requirement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE she_workload ENABLE ROW LEVEL SECURITY;

-- Policies: allow anon access (same pattern as other tables)
CREATE POLICY "anon_select_she_personnel" ON she_personnel FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_she_personnel" ON she_personnel FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_she_personnel" ON she_personnel FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_she_personnel" ON she_personnel FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_legal_req" ON legal_requirement_types FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_legal_req" ON legal_requirement_types FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_legal_req" ON legal_requirement_types FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_legal_req" ON legal_requirement_types FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_pers_lic" ON personnel_licenses FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_pers_lic" ON personnel_licenses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_pers_lic" ON personnel_licenses FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_pers_lic" ON personnel_licenses FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_workload" ON she_workload FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_workload" ON she_workload FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_workload" ON she_workload FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_workload" ON she_workload FOR DELETE TO anon USING (true);
