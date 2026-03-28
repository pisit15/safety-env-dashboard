import { NextResponse } from 'next/server';

// Admin password stored in env var
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'eaadmin2026';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true, role: 'admin' });
    }

    return NextResponse.json({ success: false, error: 'รหัสผ่าน Admin ไม่ถูกต้อง' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
