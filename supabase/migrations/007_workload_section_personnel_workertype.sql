-- =============================================
-- Add work_section, assigned_personnel_ids, worker_type to she_workload
-- =============================================

-- work_section: SHE, Safety, Environment, ISO, Safety & ISO, อื่นๆ
ALTER TABLE she_workload ADD COLUMN IF NOT EXISTS work_section text DEFAULT 'SHE';

-- assigned_personnel_ids: array of personnel UUIDs (multi-select)
ALTER TABLE she_workload ADD COLUMN IF NOT EXISTS assigned_personnel_ids uuid[] DEFAULT '{}';

-- worker_type: 5day (Mon-Fri, 232 days, 97440 min/yr) or 6day (Mon-Sat, 284 days, 119280 min/yr)
ALTER TABLE she_workload ADD COLUMN IF NOT EXISTS worker_type text DEFAULT '5day';
