-- ============================================================
-- Special Projects Module — Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Main projects table
CREATE TABLE IF NOT EXISTS special_projects (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       text NOT NULL,

  -- Classification (bounded context — ไม่ปน plan_type ของ annual plan)
  plan_type        text CHECK (plan_type IN ('safety', 'environment')),
  -- null = general / cross-dept project
  project_scope    text NOT NULL DEFAULT 'internal'
                   CHECK (project_scope IN ('internal', 'cross_dept')),
  requesting_dept  text,   -- ระบุเมื่อ project_scope = 'cross_dept'
  category         text,   -- 'compliance' | 'infrastructure' | 'csr' | 'capex' | 'other'

  -- Core info
  title            text NOT NULL,
  description      text,
  owner            text NOT NULL,

  -- Status & Timeline
  status           text NOT NULL DEFAULT 'planning'
                   CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  start_date       date NOT NULL,
  end_date         date NOT NULL,

  -- Progress (manual override — auto-compute from milestones ทีหลัง)
  completion_pct   int  NOT NULL DEFAULT 0
                   CHECK (completion_pct >= 0 AND completion_pct <= 100),

  -- Budget (รอบแรก: manual field — upgrade เป็น SUM(transactions) ทีหลัง)
  budget_planned   numeric NOT NULL DEFAULT 0,
  budget_actual    numeric NOT NULL DEFAULT 0,

  -- Metadata
  notes            text,
  created_by       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Milestones / Phases
CREATE TABLE IF NOT EXISTS project_milestones (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid NOT NULL REFERENCES special_projects(id) ON DELETE CASCADE,

  title           text NOT NULL,
  description     text,
  order_no        int  NOT NULL DEFAULT 0,

  planned_start   date,
  planned_end     date,
  actual_end      date,

  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','done','delayed','cancelled')),
  completion_pct  int  NOT NULL DEFAULT 0
                  CHECK (completion_pct >= 0 AND completion_pct <= 100),

  note            text,
  updated_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_special_projects_company
  ON special_projects(company_id);

CREATE INDEX IF NOT EXISTS idx_special_projects_status
  ON special_projects(company_id, status);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project
  ON project_milestones(project_id, order_no);

-- Auto-update updated_at trigger for special_projects
CREATE OR REPLACE FUNCTION update_special_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_special_projects_updated_at ON special_projects;
CREATE TRIGGER trg_special_projects_updated_at
  BEFORE UPDATE ON special_projects
  FOR EACH ROW EXECUTE FUNCTION update_special_projects_updated_at();
