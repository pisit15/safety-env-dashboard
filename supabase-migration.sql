-- ============================================
-- Migration: Audit Log, Attachments, Deadlines, Edit Requests
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. AUDIT LOG — บันทึกทุกการเปลี่ยนแปลง
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'status_change', 'responsible_change', 'file_upload', 'file_delete', 'edit_request'
  activity_no TEXT,
  month TEXT,
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  note TEXT DEFAULT '',
  performed_by TEXT NOT NULL,  -- company name or 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select audit_log" ON audit_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert audit_log" ON audit_log FOR INSERT TO anon WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_audit_log_company ON audit_log(company_id, created_at DESC);

-- 2. ACTIVITY ATTACHMENTS — เก็บ metadata ไฟล์หลักฐาน (ไฟล์จริงอยู่ Google Drive)
CREATE TABLE IF NOT EXISTS activity_attachments (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  activity_no TEXT NOT NULL,
  month TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,        -- Google Drive view URL
  drive_file_id TEXT NOT NULL,   -- Google Drive file ID
  file_type TEXT DEFAULT '',     -- 'image', 'pdf', 'excel', etc.
  file_size INTEGER DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select attachments" ON activity_attachments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert attachments" ON activity_attachments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete attachments" ON activity_attachments FOR DELETE TO anon USING (true);

CREATE INDEX idx_attachments_activity ON activity_attachments(company_id, plan_type, activity_no, month);

-- 3. EDIT DEADLINES — กำหนดเส้นตายแก้ไขรายเดือน
CREATE TABLE IF NOT EXISTS edit_deadlines (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,  -- 'jan', 'feb', ... 'dec'
  deadline_day INTEGER NOT NULL DEFAULT 10,  -- วันที่ของเดือนถัดไป (เช่น 10 = วันที่ 10 ของเดือนถัดไป)
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE edit_deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select deadlines" ON edit_deadlines FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon all deadlines" ON edit_deadlines FOR ALL TO anon USING (true) WITH CHECK (true);

-- Insert default deadlines (วันที่ 10 ของเดือนถัดไป)
INSERT INTO edit_deadlines (month, deadline_day) VALUES
  ('jan', 10), ('feb', 10), ('mar', 10), ('apr', 10),
  ('may', 10), ('jun', 10), ('jul', 10), ('aug', 10),
  ('sep', 10), ('oct', 10), ('nov', 10), ('dec', 10)
ON CONFLICT (month) DO NOTHING;

-- 4. EDIT REQUESTS — คำขอแก้ไขหลัง deadline
CREATE TABLE IF NOT EXISTS edit_requests (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  activity_no TEXT NOT NULL,
  month TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  reviewed_by TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- หมดอายุอนุมัติเมื่อไหร่
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE edit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select edit_requests" ON edit_requests FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert edit_requests" ON edit_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update edit_requests" ON edit_requests FOR UPDATE TO anon USING (true);

CREATE INDEX idx_edit_requests_company ON edit_requests(company_id, status);
