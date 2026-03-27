// Demo data used when Google Sheets API is not configured
// Based on real data from EBI and AMT PDFs

import { Activity, CompanySummary, DashboardData } from './types';

export const DEMO_COMPANIES: CompanySummary[] = [
  { companyId: 'ebi', companyName: 'EBI', shortName: 'EBI', total: 45, done: 12, inProgress: 5, notStarted: 28, budget: 4635710, pctDone: 26.7 },
  { companyId: 'amt', companyName: 'AMT', shortName: 'AMT', total: 52, done: 15, inProgress: 8, notStarted: 29, budget: 712584, pctDone: 28.8 },
  { companyId: 'aab', companyName: 'AAB', shortName: 'AAB', total: 38, done: 10, inProgress: 3, notStarted: 25, budget: 350000, pctDone: 26.3 },
  { companyId: 'esn', companyName: 'ESN', shortName: 'ESN', total: 41, done: 8, inProgress: 4, notStarted: 29, budget: 520000, pctDone: 19.5 },
  { companyId: 'esm', companyName: 'ESM', shortName: 'ESM', total: 35, done: 11, inProgress: 2, notStarted: 22, budget: 280000, pctDone: 31.4 },
  { companyId: 'esl', companyName: 'ESL', shortName: 'ESL', total: 40, done: 9, inProgress: 6, notStarted: 25, budget: 410000, pctDone: 22.5 },
  { companyId: 'eslo', companyName: 'ESLO', shortName: 'ESLO', total: 37, done: 7, inProgress: 3, notStarted: 27, budget: 290000, pctDone: 18.9 },
  { companyId: 'esp', companyName: 'ESP', shortName: 'ESP', total: 43, done: 13, inProgress: 5, notStarted: 25, budget: 480000, pctDone: 30.2 },
  { companyId: 'ewhk', companyName: 'EWHK', shortName: 'EWHK', total: 36, done: 6, inProgress: 4, notStarted: 26, budget: 310000, pctDone: 16.7 },
  { companyId: 'hnm', companyName: 'HNM', shortName: 'HNM', total: 39, done: 10, inProgress: 3, notStarted: 26, budget: 370000, pctDone: 25.6 },
  { companyId: 'mmc', companyName: 'MMC', shortName: 'MMC', total: 44, done: 14, inProgress: 7, notStarted: 23, budget: 550000, pctDone: 31.8 },
  { companyId: 'ea-hq', companyName: 'EA HQ', shortName: 'EA HQ', total: 34, done: 8, inProgress: 2, notStarted: 24, budget: 200000, pctDone: 23.5 },
  { companyId: 'ea-kabin', companyName: 'EA Kabin', shortName: 'EA Kabin', total: 42, done: 11, inProgress: 5, notStarted: 26, budget: 450000, pctDone: 26.2 },
];

export function getDemoDashboard(): DashboardData {
  const companies = DEMO_COMPANIES;
  return {
    companies,
    totalActivities: companies.reduce((s, c) => s + c.total, 0),
    totalDone: companies.reduce((s, c) => s + c.done, 0),
    totalInProgress: companies.reduce((s, c) => s + c.inProgress, 0),
    totalNotStarted: companies.reduce((s, c) => s + c.notStarted, 0),
    totalBudget: companies.reduce((s, c) => s + c.budget, 0),
    overallPct: Math.round(
      (companies.reduce((s, c) => s + c.done, 0) /
        companies.reduce((s, c) => s + c.total, 0)) * 1000
    ) / 10,
  };
}

export const DEMO_EBI_ACTIVITIES: Activity[] = [
  { no: '1.1', activity: 'แต่งตั้ง กำหนดหน้าที่ความรับผิดชอบบุคลากรด้านสิ่งแวดล้อมประจำโรงงาน', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '✓', feb: '✓', mar: '✓', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ปฏิบัติตามกฎหมาย', status: 'done', follower: 'HSE HQ' },
  { no: '1.2', activity: 'ต่อทะเบียนรับรองเจ้าหน้าที่บุคลากรด้านสิ่งแวดล้อมประจำโรงงาน', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '', feb: '', mar: '', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ปฏิบัติตามกฎหมาย', status: 'not_started', follower: 'HSE HQ' },
  { no: '2.1.1', activity: 'ตรวจสอบสถานที่จัดเก็บของเสีย (Waste storage area inspection)', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '✓', feb: '✓', mar: '✓', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ไม่พบความผิดปกติ', status: 'done', follower: 'HSE HQ' },
  { no: '2.1.2', activity: 'ตรวจสอบประสิทธิภาพระบบบำบัดน้ำเสีย (Wastewater inspection)', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '✓', feb: '✓', mar: '✓', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ไม่พบความผิดปกติ', status: 'done', follower: 'HSE HQ' },
  { no: '2.1.3', activity: 'ตรวจความสะอาดและการจัดการด้านสิ่งแวดล้อม (Environmental Patrol)', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '✓', feb: '✓', mar: '✓', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ไม่พบความผิดปกติ', status: 'done', follower: 'HSE HQ' },
  { no: '2.1.6', activity: 'ตรวจวัดคุณภาพน้ำทิ้ง (Wastewater monitoring)', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '✓', feb: '', mar: '', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ผ่านมาตรฐาน', status: 'in_progress', follower: 'HSE HQ' },
  { no: '2.1.9', activity: 'ตรวจวัดสารมลพิษจากปล่องระบายอากาศ (Stack monitoring)', responsible: 'ENV', budget: 0, type: 'actual', months: { jan: '', feb: '', mar: '', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ผ่านมาตรฐาน', status: 'not_started', follower: 'HSE HQ' },
  { no: '3.3.1', activity: 'การประเมินสิ่งแวดล้อมพื้นที่โรงงาน (สารอันตราย)', responsible: 'ENV', budget: 1000000, type: 'actual', months: { jan: '', feb: '', mar: '✓', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ไม่พบความผิดปกติ', status: 'in_progress', follower: 'HSE HQ' },
  { no: '5.1', activity: 'กิจกรรม Big Cleaning Day ประจำปี', responsible: 'ทุกฝ่าย', budget: 3000, type: 'actual', months: { jan: '', feb: '', mar: '', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'พื้นที่สะอาดเรียบร้อย', status: 'not_started', follower: 'HSE HQ' },
  { no: '6.1', activity: 'บุคลากรด้านสิ่งแวดล้อมประจำโรงงาน (อบรม)', responsible: 'ENV', budget: 20000, type: 'actual', months: { jan: '', feb: '', mar: '', apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '' }, target: 'ดำเนินการตามแผนงาน', status: 'not_started', follower: 'HSE HQ' },
];
