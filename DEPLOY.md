# Safety & Environment Dashboard — Deploy Guide

## สิ่งที่ได้
- **HQ Overview** — ภาพรวมแผนงาน 13 บริษัท (KPI, Ranking Chart, Status Pie, Budget Chart)
- **Company Drill-down** — รายละเอียดกิจกรรมของแต่ละบริษัท พร้อม Quick Update form
- **Admin Page** — เพิ่ม/แก้ไข Google Sheet URL ของแต่ละบริษัท
- **Dark Theme** — สไตล์ shadcn/ui (สวยกว่า Streamlit)
- **API Routes** — ดึงข้อมูลจาก Google Sheets อัตโนมัติ

## ขั้นตอน Deploy ไป Vercel

### 1. สร้าง Google Cloud Service Account
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project ใหม่ หรือใช้ที่มีอยู่
3. เปิด API: **Google Sheets API** + **Google Drive API**
4. ไปที่ Credentials → Create Credentials → **Service Account**
5. สร้าง Key → JSON → ดาวน์โหลดไฟล์ .json

### 2. Share Google Sheets
- เปิด Google Spreadsheet ของแต่ละบริษัท
- กด Share → เพิ่ม email ของ Service Account (เช่น `xxx@project.iam.gserviceaccount.com`)
- ให้สิทธิ์ **Viewer** (อ่านอย่างเดียว) หรือ **Editor** (ถ้าต้องการให้ Dashboard เขียนได้)

### 3. Push โค้ดไป GitHub
```bash
cd safety-dashboard
git init
git add .
git commit -m "Initial: Safety Dashboard prototype"
git remote add origin https://github.com/YOUR_USERNAME/safety-dashboard.git
git push -u origin main
```

### 4. Deploy บน Vercel
1. ไปที่ [vercel.com](https://vercel.com) → Import Git Repository
2. เลือก repo `safety-dashboard`
3. ตั้ง Environment Variables:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = (วาง JSON ทั้งหมดจากไฟล์ Service Account)
4. กด Deploy!

### 5. ทดสอบ
- เปิด URL ที่ Vercel ให้ → จะเห็น Dashboard ด้วย demo data
- ถ้าตั้ง Service Account ถูกต้อง → จะดึงข้อมูลจริงจาก Google Sheets

## โครงสร้างไฟล์
```
safety-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← HQ Overview (หน้าหลัก)
│   │   ├── layout.tsx            ← Layout + Font
│   │   ├── globals.css           ← Tailwind + Custom styles
│   │   ├── admin/page.tsx        ← Admin (จัดการบริษัท)
│   │   ├── company/[id]/page.tsx ← Company Drill-down
│   │   └── api/
│   │       ├── dashboard/route.ts ← API: ดึงข้อมูลภาพรวม
│   │       └── company/route.ts   ← API: ดึงข้อมูลรายบริษัท
│   ├── components/
│   │   ├── Sidebar.tsx           ← เมนูด้านซ้าย
│   │   ├── KPICard.tsx           ← การ์ด KPI
│   │   ├── StatusBadge.tsx       ← Badge สถานะ
│   │   └── Charts.tsx            ← กราฟ (Ranking, Pie, Budget)
│   └── lib/
│       ├── types.ts              ← TypeScript types
│       ├── companies.ts          ← รายชื่อบริษัท + Sheet IDs
│       ├── sheets.ts             ← Google Sheets API logic
│       └── demo-data.ts          ← ข้อมูลตัวอย่าง
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
└── package.json
```

## แก้ไข/เพิ่มบริษัท
แก้ไขไฟล์ `src/lib/companies.ts` — เพิ่ม Sheet ID และชื่อ Sheet

## ต้นทุน
- **Vercel Free** = 0 บาท (bandwidth 100GB, serverless 100hrs)
- **Vercel Pro** = ~700 บาท/เดือน (unlimited)
- **Google Cloud** = ฟรี (Sheets API quota สูงมาก)
