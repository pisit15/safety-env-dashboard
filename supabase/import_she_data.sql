-- =============================================
-- SHE Workforce Data Import
-- Source: EA HSE Team Google Sheets
-- =============================================

-- PART 1: Insert Personnel (43 people)
-- =============================================
INSERT INTO she_personnel (company_id, bu, full_name, nick_name, position, responsibility, department, employment_type, phone, email, is_active)
VALUES
  -- EA HQ (3 คน)
  ('ea-hq', 'HO', 'พิสิษฐ์ แซ่จง', 'Jobs', 'Assistant Vice President', 'จป.วิชาชีพ', 'HSE', 'permanent', '083-5868772', 'pisit.sae@amitathailand.co.th', true),
  ('ea-hq', 'HO', 'ดวงกมล ถวิลหา', 'ฝน', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '', '', true),
  ('ea-hq', 'HO', 'สุภัทชา วิเชียรลม', 'แพท', '', 'เจ้าหน้าที่สิ่งแวดล้อม', 'HSE', 'permanent', '085-2429565', 'suputsha.wic@energyabsolute.co.th', true),

  -- EA Kabin (8 คน)
  ('ea-kabin', 'Biodiesel', 'คมสันต์ ประภาพรดิลก', 'โต', 'HSE Manager', '', 'HSE', 'permanent', '', '', true),
  ('ea-kabin', 'Biodiesel', 'นิ่มนวล มงคลดี', 'นิ่ม', 'ผู้ช่วยผู้จัดการแผนกความปลอดภัย & DCC', 'จป.วิชาชีพ', 'HSE', 'permanent', '080-5624978', 'nimnual.m@energyabsolute.co.th', true),
  ('ea-kabin', 'Biodiesel', 'สราวุฒิ อรภาพ', 'หนุ่ย', '', 'หัวหน้าแผนก', 'HSE', 'permanent', '085-5686659', 'sarawut.a@energyabsolute.co.th', true),
  ('ea-kabin', 'Biodiesel', 'สุวรรณสาม เยรัมย์', 'นาย', '', 'ผช.จป.วิชาชีพ', 'HSE', 'permanent', '096-3922358', '', true),
  ('ea-kabin', 'Biodiesel', 'มานะ กลิ่นจันทร์', 'โต้ง', '', 'ผช.จป.วิชาชีพ', 'HSE', 'permanent', '065-5903673', '', true),
  ('ea-kabin', 'Biodiesel', 'นัฐพล นนตรี', 'ต่อ', '', 'ผช.จป.วิชาชีพ', 'HSE', 'permanent', '097-2698638', 'Nattapon.non@energyabsolute.co.th', true),
  ('ea-kabin', 'Biodiesel', 'นายกิตติศักดิ์ แสงบัลลัง', 'ตอง', '', 'หัวหน้าแผนกสิ่งแวดล้อม', 'HSE', 'permanent', '090-9823593', 'kittisak.san@energyabsolute.co.th', true),
  ('ea-kabin', 'Biodiesel', 'พิชิต คงทน', 'กอล์ฟ', '', 'ผช.จนท.สิ่งแวดล้อม', 'HSE', 'permanent', '098-6419936', 'pichit.kon@energyabsolute.co.th', true),

  -- EBI (5 คน)
  ('ebi', 'Biodiesel', 'กฤษนลัส จันทร์ชนะ', 'พรีม', 'HSE Supervisor', '', 'HSE', 'permanent', '090-8950050', 'Kritsanalas@ebi.co.th', true),
  ('ebi', 'Biodiesel', 'ธนพงศ์ กิ่งเกตุ', 'เบิร์ส', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '088-7295199', 'thanapong@ebi.co.th', true),
  ('ebi', 'Biodiesel', 'กฤติพงษ์ บัวทอง', 'ต่อ', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '064-9619659', 'krittipong@ebi.co.th', true),
  ('ebi', 'Biodiesel', 'วัชรพล โพโต', 'เชน', '', 'จป.เทคนิค', 'HSE', 'permanent', '096-1459154', 'watcharapon@ebi.co.th', true),
  ('ebi', 'Biodiesel', 'พัชรพงษ์ มาชม', 'เอิร์ธ', '', 'เจ้าหน้าที่สิ่งแวดล้อม', 'HSE', 'permanent', '083-0748694', 'patcharapong@ebi.co.th', true),

  -- Renewable Energy (7 คน)
  ('esp', 'Renewable Energy', 'สุรศักดิ์ เพชรจินดา', '', '', 'HSE Officer', 'HSE', 'permanent', '', '', true),
  ('esl', 'Renewable Energy', 'สุริยะ กุณาปัน', '', '', 'HSE Officer', 'HSE', 'permanent', '', '', true),
  ('esn', 'Renewable Energy', 'ว่าง (Vacant)', '-', '', 'HSE Officer', 'HSE', 'permanent', '', '', false),
  ('eslo', 'Renewable Energy', 'ว่าง (Vacant)', '-', '', 'HSE Officer', 'HSE', 'permanent', '', '', false),
  ('hnm', 'Renewable Energy', 'ธนาเดช พิมพ์เพ็ชร', '', '', 'HSE Officer', 'HSE', 'permanent', '', '', true),
  ('ewhk', 'Renewable Energy', 'อรรถพล ภูมิลุน', 'เอ', 'HSE Officer', '', 'HSE', 'permanent', '097-2354289', 'attapol.p@energyabsolute.co.th', true),
  ('ewhk', 'Renewable Energy', 'ทวีศิลป์ พงษ์สว่าง', 'หนู', 'HSE Officer', '', 'HSE', 'permanent', '097-1175965', 'taweesil.p@energyabsolute.co.th', true),

  -- AMT (9 คน — 6 permanent, 3 subcontract)
  ('amt', 'EV', 'ลัดดาวัลย์ มณี', 'ผึ้ง', 'ผู้จัดการอาวุโสแผนกSHE', '', 'HSE', 'permanent', '081-9893922', 'laddawan.m@amitathailand.co.th', true),
  ('amt', 'EV', 'จิรายุ ลิ้มกุล', 'บีม', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '095-6249665', 'jirayu.l@amitathailand.co.th', true),
  ('amt', 'EV', 'ณัฐพร หงส์วิลัย', 'เฟิร์น', '', 'เจ้าหน้าที่สิ่งแวดล้อม', 'HSE', 'permanent', '062-4921497', 'nattaporn.h@amitathailand.co.th', true),
  ('amt', 'EV', 'ปิยาภรณ์ อมรสิน', 'แพรว', '', 'พยาบาลวิชาชีพ', 'HSE', 'permanent', '096-8916289', 'piyaporn.a@amitathailand.co.th', true),
  ('amt', 'EV', 'จิณณพัต ดำศิริ', 'เจ', '', 'จป.เทคนิค', 'HSE', 'permanent', '080-0866997', 'jinnapat.d@amitathailand.co.th', true),
  ('amt', 'EV', 'นิธิรุจน์ คงวัฒนะ', 'เบนซ์', '', 'จป.เทคนิค', 'HSE', 'permanent', '093-3635495', 'nithiruj.k@amitathailand.co.th', true),
  ('amt', 'EV', 'ปฐพี ยาชมภู', 'โอ๊ค', '', 'จป.เทคนิค', 'HSE', 'subcontract', '093-3589145', 'patapee.y@amitathailand.co.th', true),
  ('amt', 'EV', 'ศิริพร ชัยราช', 'ฟ้า', '', 'จป.เทคนิค', 'HSE', 'subcontract', '065-2365014', 'siriporn.c@amitathailand.co.th', true),
  ('amt', 'EV', 'ปริวัชร แม้นพิบูลย์', 'เก่ง', '', 'จป.เทคนิค', 'HSE', 'subcontract', '094-5398965', 'pariwat.m@amitathailand.co.th', true),

  -- MMC (3 คน)
  ('mmc', 'EV', 'ยุทธพิชัย ทับแสง', 'โก๋', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '080-4412668', 'yuttapichai.t@minemobility.com', true),
  ('mmc', 'EV', 'อรรถกฤต ชาญธัญกรรม', 'เกมส์', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '098-8356451', 'atthakrit.c@minemobility.com', true),
  ('mmc', 'EV', 'สุวนันท์ ทิพย์ปิ่นทอง', 'กวาง', '', 'จป.เทคนิค', 'HSE', 'permanent', '086-3594613', 'suwanan.t@minemobility.com', true),

  -- AAB (5 คน)
  ('aab', 'EV', 'อรรถกฤต ชาญธัญกรรม', 'เกมส์', 'ผู้จัดการแผนก', '', 'HSE', 'permanent', '098-8356451', 'atthakrit.c@minemobility.com', true),
  ('aab', 'EV', 'สุภาพร กุลบุตร', 'อ้อม', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '080-8070757', 'supaporn.k@absoluteassembly.com', true),
  ('aab', 'EV', 'วนิดา หงษ์กรรณ์', 'แอ๊ด', '', 'จป.วิชาชีพ', 'HSE', 'permanent', '098-9149291', 'wanida.h@absoluteassembly.com', true),
  ('aab', 'EV', 'จินดาวรรณ เจริญทรัพย์', 'เนตร', '', 'จป.เทคนิค', 'HSE', 'permanent', '082-8940628', 'jindawan.c@absoluteassembly.com', true),
  ('aab', 'EV', 'พีรพัฒน์ สมเด็จ', 'ปิง', '', 'จป.เทคนิค', 'HSE', 'permanent', '097-1282689', 'peeraphat.s@absoluteassembly.com', true),

  -- ESM (2 คน)
  ('esm', 'EV', 'สิทธิพล เดชมา', 'ต้อ', 'จป.วิชาชีพ', '', 'HSE', 'permanent', '085-7994745', 'sittipon.d@smartmobility.co.th', true),
  ('esm', 'EV', 'ชยาทิต ใคร่ครวญ', 'ต้น', 'จป.เทคนิค', '', 'HSE', 'permanent', '064-4659445', 'chayathit.k@smartmobility.co.th', true),

  -- WMP (1 คน)
  ('wmp', 'Waste Management', 'ธัญญาลักษณ์ ชลเจริญ', 'เจ', 'จป.วิชาชีพ', '', 'HSE', 'permanent', '', '', true)
ON CONFLICT DO NOTHING;


-- =============================================
-- PART 2: Legal Requirement Types (14 ประเภทใบอนุญาต × 14 บริษัท)
-- =============================================
DO $$
DECLARE
  comp text;
  companies text[] := ARRAY['ea-hq','ea-kabin','ebi','esp','esl','esn','eslo','hnm','ewhk','amt','mmc','aab','esm','wmp'];
BEGIN
  FOREACH comp IN ARRAY companies LOOP
    INSERT INTO legal_requirement_types (company_id, name, short_name, category, sort_order, is_active) VALUES
      (comp, 'เจ้าหน้าที่ความปลอดภัยระดับวิชาชีพ', 'จป.วิชาชีพ', 'safety', 1, true),
      (comp, 'เจ้าหน้าที่ความปลอดภัยระดับเทคนิค', 'จป.เทคนิค', 'safety', 2, true),
      (comp, 'บุคลากรเฉพาะ', 'บฉ.', 'safety', 3, true),
      (comp, 'ผู้ควบคุมก๊าซ', 'ผู้ควบคุมก๊าซ', 'safety', 4, true),
      (comp, 'เจ้าหน้าที่ความปลอดภัยรังสี', 'จนท.รังสี', 'safety', 5, true),
      (comp, 'ผู้จัดการสิ่งแวดล้อม', 'ผจก.สวล.', 'environment', 6, true),
      (comp, 'ผู้ควบคุมมลพิษทางน้ำ', 'ผู้ควบคุมน้ำ', 'environment', 7, true),
      (comp, 'ผู้ควบคุมมลพิษทางอากาศ', 'ผู้ควบคุมอากาศ', 'environment', 8, true),
      (comp, 'ผู้ควบคุมมลพิษทางกากอุตสาหกรรม', 'ผู้ควบคุมกากฯ', 'environment', 9, true),
      (comp, 'ผู้ปฏิบัติงานประจำระบบบำบัดมลพิษน้ำ', 'ผู้ปฏิบัติน้ำ', 'environment', 10, true),
      (comp, 'ผู้ปฏิบัติงานประจำระบบบำบัดมลพิษอากาศ', 'ผู้ปฏิบัติอากาศ', 'environment', 11, true),
      (comp, 'ผู้ปฏิบัติงานประจำระบบบำบัดมลพิษกากอุตสาหกรรม', 'ผู้ปฏิบัติกากฯ', 'environment', 12, true),
      (comp, 'ผู้รับผิดชอบด้านพลังงานอาวุโส', 'ผอส.', 'environment', 13, true),
      (comp, 'ผู้รับผิดชอบด้านพลังงานสามัญโรงงาน', 'ผชร.', 'environment', 14, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;


-- =============================================
-- PART 3: License Matrix (personnel_licenses)
-- Match by full_name + company_id → personnel_id
-- Match by short_name + company_id → requirement_type_id
-- "/" = has_license = true
-- =============================================
DO $$
DECLARE
  p_id uuid;
  r_id uuid;
BEGIN

  -- Helper: insert license record
  -- We'll do each person individually

  -- === AAB ===
  -- 1. อรรถกฤต ชาญธัญกรรม (AAB): จป.วิชาชีพ, ผู้ควบคุมน้ำ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'อรรถกฤต ชาญธัญกรรม' AND company_id = 'aab' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'ผู้ควบคุมน้ำ' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 2. สุภาพร กุลบุตร (AAB): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'สุภาพร กุลบุตร' AND company_id = 'aab' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 3. วนิดา หงษ์กรรณ์ (AAB): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'วนิดา หงษ์กรรณ์' AND company_id = 'aab' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 4. จินดาวรรณ เจริญทรัพย์ (AAB): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'จินดาวรรณ เจริญทรัพย์' AND company_id = 'aab' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 5. พีรพัฒน์ สมเด็จ (AAB): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'พีรพัฒน์ สมเด็จ' AND company_id = 'aab' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'aab' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- === AMT ===
  -- 6. ลัดดาวัลย์ มณี (AMT): จป.วิชาชีพ, บฉ., ผจก.สวล., ผู้ควบคุมน้ำ, ผู้ควบคุมอากาศ, ผู้ควบคุมกากฯ, ผู้ปฏิบัติน้ำ, ผู้ปฏิบัติอากาศ, ผอส.
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ลัดดาวัลย์ มณี' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'amt' AND short_name IN ('จป.วิชาชีพ','บฉ.','ผจก.สวล.','ผู้ควบคุมน้ำ','ผู้ควบคุมอากาศ','ผู้ควบคุมกากฯ','ผู้ปฏิบัติน้ำ','ผู้ปฏิบัติอากาศ','ผอส.') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 7. จิรายุ ลิ้มกุล (AMT): จป.วิชาชีพ, บฉ.
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'จิรายุ ลิ้มกุล' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'amt' AND short_name IN ('จป.วิชาชีพ','บฉ.') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 8. ณัฐพร หงส์วิลัย (AMT): ผู้ควบคุมน้ำ, ผู้ควบคุมอากาศ, ผู้ควบคุมกากฯ, ผู้ปฏิบัติน้ำ, ผู้ปฏิบัติอากาศ, ผู้ปฏิบัติกากฯ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ณัฐพร หงส์วิลัย' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'amt' AND short_name IN ('ผู้ควบคุมน้ำ','ผู้ควบคุมอากาศ','ผู้ควบคุมกากฯ','ผู้ปฏิบัติน้ำ','ผู้ปฏิบัติอากาศ','ผู้ปฏิบัติกากฯ') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 10. จิณณพัต ดำศิริ (AMT): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'จิณณพัต ดำศิริ' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'amt' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 11. นิธิรุจน์ คงวัฒนะ (AMT): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'นิธิรุจน์ คงวัฒนะ' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'amt' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 12. ปฐพี ยาชมภู (AMT): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ปฐพี ยาชมภู' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'amt' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 13. ศิริพร ชัยราช (AMT): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ศิริพร ชัยราช' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'amt' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 14. ปริวัชร แม้นพิบูลย์ (AMT): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ปริวัชร แม้นพิบูลย์' AND company_id = 'amt' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'amt' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- === MMC ===
  -- 15. ยุทธพิชัย ทับแสง (MMC): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ยุทธพิชัย ทับแสง' AND company_id = 'mmc' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'mmc' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 16. อรรถกฤต ชาญธัญกรรม (MMC): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'อรรถกฤต ชาญธัญกรรม' AND company_id = 'mmc' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'mmc' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 17. สุวนันท์ ทิพย์ปิ่นทอง (MMC): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'สุวนันท์ ทิพย์ปิ่นทอง' AND company_id = 'mmc' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'mmc' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- === EA Kabin ===
  -- 18. คมสันต์ ประภาพรดิลก (ea-kabin): จป.วิชาชีพ, ผจก.สวล., ผู้ควบคุมน้ำ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'คมสันต์ ประภาพรดิลก' AND company_id = 'ea-kabin' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ea-kabin' AND short_name IN ('จป.วิชาชีพ','ผจก.สวล.','ผู้ควบคุมน้ำ') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 19. นิ่มนวล มงคลดี (ea-kabin): จป.วิชาชีพ, ผู้ควบคุมน้ำ, ผู้ควบคุมอากาศ, ผู้ปฏิบัติน้ำ, ผอส., ผชร.
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'นิ่มนวล มงคลดี' AND company_id = 'ea-kabin' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ea-kabin' AND short_name IN ('จป.วิชาชีพ','ผู้ควบคุมน้ำ','ผู้ควบคุมอากาศ','ผู้ปฏิบัติน้ำ','ผอส.','ผชร.') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 20. สราวุฒิ อรภาพ (ea-kabin): จป.เทคนิค, บฉ.
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'สราวุฒิ อรภาพ' AND company_id = 'ea-kabin' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ea-kabin' AND short_name IN ('จป.เทคนิค','บฉ.') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- === EBI ===
  -- 21. กฤษนลัส จันทร์ชนะ (EBI): จป.วิชาชีพ, บฉ., ผู้ควบคุมน้ำ, ผู้ปฏิบัติน้ำ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'กฤษนลัส จันทร์ชนะ' AND company_id = 'ebi' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ebi' AND short_name IN ('จป.วิชาชีพ','บฉ.','ผู้ควบคุมน้ำ','ผู้ปฏิบัติน้ำ') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 22. ธนพงศ์ กิ่งเกตุ (EBI): จป.วิชาชีพ, บฉ.
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'ธนพงศ์ กิ่งเกตุ' AND company_id = 'ebi' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ebi' AND short_name IN ('จป.วิชาชีพ','บฉ.') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 23. กฤติพงษ์ บัวทอง (EBI): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'กฤติพงษ์ บัวทอง' AND company_id = 'ebi' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'ebi' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 24. วัชรพล โพโต (EBI): จป.เทคนิค
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'วัชรพล โพโต' AND company_id = 'ebi' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.เทคนิค' AND company_id = 'ebi' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- 25. พัชรพงษ์ มาชม (EBI): ผู้ควบคุมน้ำ, ผู้ปฏิบัติน้ำ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'พัชรพงษ์ มาชม' AND company_id = 'ebi' LIMIT 1;
  IF p_id IS NOT NULL THEN
    FOR r_id IN SELECT id FROM legal_requirement_types WHERE company_id = 'ebi' AND short_name IN ('ผู้ควบคุมน้ำ','ผู้ปฏิบัติน้ำ') LOOP
      INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
    END LOOP;
  END IF;

  -- === ESM ===
  -- 26. สิทธิพล เดชมา (ESM): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'สิทธิพล เดชมา' AND company_id = 'esm' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'esm' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

  -- === EWHK ===
  -- 27. อรรถพล ภูมิลุน (EWHK): จป.วิชาชีพ
  SELECT id INTO p_id FROM she_personnel WHERE full_name = 'อรรถพล ภูมิลุน' AND company_id = 'ewhk' LIMIT 1;
  IF p_id IS NOT NULL THEN
    SELECT id INTO r_id FROM legal_requirement_types WHERE short_name = 'จป.วิชาชีพ' AND company_id = 'ewhk' LIMIT 1;
    INSERT INTO personnel_licenses (personnel_id, requirement_type_id, has_license) VALUES (p_id, r_id, true) ON CONFLICT (personnel_id, requirement_type_id) DO NOTHING;
  END IF;

END $$;


-- =============================================
-- Verification: ตรวจสอบผลการ import
-- =============================================
SELECT 'Personnel' as table_name, count(*) as row_count FROM she_personnel
UNION ALL
SELECT 'Requirement Types', count(*) FROM legal_requirement_types
UNION ALL
SELECT 'Licenses', count(*) FROM personnel_licenses;
