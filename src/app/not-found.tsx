'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
        background: '#fbfbfd',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', color: '#1d1d1f', lineHeight: 1 }}>
          404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1d1d1f', margin: '16px 0 8px' }}>
          ไม่พบหน้าที่ต้องการ
        </h1>
        <p style={{ fontSize: 15, color: '#6e6e73', lineHeight: 1.6, marginBottom: 24 }}>
          หน้านี้อาจถูกย้ายหรือไม่มีอยู่แล้ว
          <br />
          ลองกลับไปหน้าเลือกโครงการ
        </p>
        <Link
          href="/projects"
          style={{
            display: 'inline-block',
            background: '#0071e3',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: 12,
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          ← กลับหน้าเลือกโครงการ
        </Link>
      </div>
    </div>
  );
}
