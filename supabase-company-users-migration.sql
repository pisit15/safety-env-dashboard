-- ============================================================
-- Migration: company_users table (multi-user per company)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create company_users table
CREATE TABLE IF NOT EXISTS company_users (
  id SERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each username must be unique within a company
  UNIQUE(company_id, username)
);

-- Enable RLS
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

-- RLS policies (anon access for API)
CREATE POLICY "Allow anon select company_users" ON company_users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert company_users" ON company_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update company_users" ON company_users FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete company_users" ON company_users FOR DELETE TO anon USING (true);

-- Migrate existing company_credentials to company_users (one user per company)
INSERT INTO company_users (company_id, username, password, display_name, is_active)
SELECT company_id, username, password, username, is_active
FROM company_credentials
ON CONFLICT (company_id, username) DO NOTHING;

-- Done! Now you can add more users per company via the Admin panel.
