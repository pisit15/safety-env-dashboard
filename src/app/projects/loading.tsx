// Global loading skeleton for /projects/* navigation
export default function ProjectsLoading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(0,0,0,0.08)',
            borderTopColor: '#0071e3',
            margin: '0 auto 16px',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <p style={{ fontSize: 13, color: '#6e6e73', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
          กำลังโหลด...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
