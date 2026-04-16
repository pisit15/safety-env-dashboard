'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1d1d1f', marginBottom: 8 }}>
          เกิดข้อผิดพลาด
        </h2>
        <p style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.6, marginBottom: 20 }}>
          ขออภัย เกิดปัญหาในการโหลดหน้านี้
          <br />
          ลองกดปุ่มด้านล่างเพื่อโหลดใหม่
        </p>
        {error.message && (
          <pre
            style={{
              fontSize: 11,
              color: '#86868b',
              background: '#f5f5f7',
              borderRadius: 10,
              padding: '10px 14px',
              overflow: 'auto',
              maxHeight: 100,
              textAlign: 'left',
              marginBottom: 16,
            }}
          >
            {error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background: '#0071e3',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ลองใหม่
          </button>
          <a
            href="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 24px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: '#fff',
              color: '#1d1d1f',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    </div>
  );
}
