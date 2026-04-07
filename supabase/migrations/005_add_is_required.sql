-- Add is_required column to legal_requirement_types
-- true = บริษัทต้องมีตามกฎหมาย (นับเข้า compliance)
-- false = บุคลากรมีใบอนุญาตนี้ แต่บริษัทไม่จำเป็นต้องมี
ALTER TABLE legal_requirement_types ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT true;
