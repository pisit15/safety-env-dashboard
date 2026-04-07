-- Add is_she_team column to she_personnel
-- true = บุคลากรในทีม SHE (สังกัดแผนก HSE)
-- false = ผู้ได้รับแต่งตั้งจากแผนกอื่น (เช่น วิศวกรผลิตที่มีใบ ผู้ควบคุมมลพิษน้ำ)
ALTER TABLE she_personnel ADD COLUMN IF NOT EXISTS is_she_team boolean DEFAULT true;
