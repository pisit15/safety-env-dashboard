-- ============================================
-- Migration 003: Activity Metadata (Category, Priority, Due Date)
-- Phase B — Overlay pattern: base data in Google Sheets, metadata in Supabase
-- Run this in Supabase SQL Editor
-- ============================================

-- ACTIVITY METADATA — เก็บ category, priority, due_date ของแต่ละกิจกรรม
-- ใช้ overlay pattern เดียวกับ status_overrides
CREATE TABLE IF NOT EXISTS activity_metadata (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,              -- 'safety' or 'environment'
  activity_no TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2025,

  -- Category: จัดกลุ่มกิจกรรม
  -- Safety categories: training, inspection, audit, ppe, emergency_drill, risk_assessment, permit, other
  -- Environment categories: compliance, monitoring, reporting, permit, waste, emission, water, other
  category TEXT DEFAULT 'other',

  -- Priority: ระดับความสำคัญ
  priority TEXT DEFAULT 'medium',       -- 'critical', 'high', 'medium', 'low'

  -- Due date: กำหนดส่ง (ถ้าไม่ระบุจะคำนวณจาก planMonths)
  due_date DATE,

  -- Notes
  notes TEXT DEFAULT '',

  updated_by TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One metadata record per activity per year
  CONSTRAINT unique_activity_metadata UNIQUE (company_id, plan_type, activity_no, year)
);

ALTER TABLE activity_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select activity_metadata" ON activity_metadata FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert activity_metadata" ON activity_metadata FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update activity_metadata" ON activity_metadata FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete activity_metadata" ON activity_metadata FOR DELETE TO anon USING (true);

-- Indexes
CREATE INDEX idx_activity_metadata_company ON activity_metadata(company_id, plan_type, year);
CREATE INDEX idx_activity_metadata_priority ON activity_metadata(priority, plan_type, year);
CREATE INDEX idx_activity_metadata_category ON activity_metadata(category, plan_type, year);
