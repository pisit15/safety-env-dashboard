'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

// SHE Workforce per-company has moved to tools.eashe.org
export default function SheWorkforceCompanyMovedRedirect() {
  const params = useParams();
  const companyId = (params.companyId as string) || '';
  useEffect(() => {
    // tools.eashe.org uses its own company routing; just send user to the landing
    window.location.replace('https://tools.eashe.org/she-workforce');
  }, [companyId]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>📦</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#1d1d1f' }}>SHE Workforce ย้ายที่แล้ว</h2>
        <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 20, lineHeight: 1.6 }}>
          ฟีเจอร์นี้ย้ายไปที่ <strong>tools.eashe.org</strong> แล้ว
          <br />
          กำลังนำคุณไปยังที่อยู่ใหม่...
        </p>
        <a
          href="https://tools.eashe.org/she-workforce"
          style={{
            display: 'inline-block',
            background: '#0071e3',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 10,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ไปที่ tools.eashe.org/she-workforce
        </a>
      </div>
    </div>
  );
}
