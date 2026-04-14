'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { PROJECTS, type ProjectId } from '@/lib/projects';
import { LogIn, X, User, Lock, ArrowRight, Loader2, Key, Building2, Lock as LockIcon } from 'lucide-react';

// Apple-inspired design system:
// - SF Pro system font stack
// - Generous whitespace, tight tracking on large headings
// - Subtle shadows, not glass morphism
// - Minimal color — mostly neutral grays with a single accent
// - Rounded corners 14-20px
// - Clean white background (light mode feel)

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

export default function ProjectsLandingPage() {
  const router = useRouter();
  const auth = useAuth();
  const { companies } = useCompanies();

  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  const resolveProjectUrl = (projectId: ProjectId, overrideCompanyId?: string) => {
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return `/projects/${projectId}`;
    const firstNav = project.nav[0];
    if (!firstNav) return `/projects/${projectId}`;
    let cid = 'all';
    if (overrideCompanyId) cid = overrideCompanyId;
    else if (!auth.isAdmin) {
      const companyIds = Object.keys(auth.companyAuth);
      if (companyIds.length > 0) cid = companyIds[0];
    }
    return firstNav.href(cid);
  };

  const [loginFor, setLoginFor] = useState<ProjectId | null>(null);
  const [loginMode, setLoginMode] = useState<'admin' | 'company'>('admin');
  const [loginCompanyId, setLoginCompanyId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleProjectClick = (projectId: ProjectId) => {
    if (isAuthed) router.push(resolveProjectUrl(projectId));
    else { setLoginFor(projectId); setLoginError(''); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginFor) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const result =
        loginMode === 'admin'
          ? await auth.adminLogin(username, password)
          : await auth.companyLogin(loginCompanyId, username, password);
      if (result.success) {
        const cid = loginMode === 'company' ? loginCompanyId : undefined;
        router.push(resolveProjectUrl(loginFor, cid));
      } else {
        setLoginError(result.error || 'Username หรือ Password ไม่ถูกต้อง');
      }
    } catch {
      setLoginError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fbfbfd', fontFamily: APPLE_FONT, color: '#1d1d1f' }}>
      {/* Top bar — Apple-style sticky nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(251,251,253,0.85)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/ea-logo.svg" alt="EA" style={{ height: 28, width: 'auto' }} />
            <div style={{ height: 20, width: 1, background: 'rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Safety & Environment
            </span>
          </div>
          {isAuthed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 13, color: '#6e6e73' }}>
                {auth.isAdmin ? `Admin · ${auth.adminName}` : 'ผู้ใช้บริษัท'}
              </span>
              <button
                onClick={() => {
                  if (auth.isAdmin) auth.adminLogout();
                  Object.keys(auth.companyAuth).forEach((cid) => auth.companyLogout(cid));
                  router.refresh();
                }}
                style={{
                  fontSize: 13, color: '#0071e3', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '6px 10px', borderRadius: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,113,227,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '80px 22px 48px', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'clamp(40px, 6vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            fontWeight: 700,
            color: '#1d1d1f',
            marginBottom: 16,
          }}
        >
          Safety & Environment.
          <br />
          <span style={{ background: 'linear-gradient(90deg, #0071e3, #34c759)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            ครบวงจร ในที่เดียว
          </span>
        </h1>
        <p
          style={{
            fontSize: 'clamp(17px, 2vw, 21px)',
            lineHeight: 1.5,
            color: '#6e6e73',
            maxWidth: 640,
            margin: '0 auto',
            fontWeight: 400,
          }}
        >
          เลือกโครงการเพื่อเริ่มต้น — บริหารจัดการความปลอดภัยและสิ่งแวดล้อม ครบวงจร 13 บริษัทในเครือ EA
        </p>
      </section>

      {/* Project grid */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 22px 96px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {PROJECTS.map((project) => {
            const Icon = project.icon;
            return (
              <button
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                disabled={!project.ready}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 18,
                  padding: '28px 24px 26px',
                  cursor: project.ready ? 'pointer' : 'not-allowed',
                  opacity: project.ready ? 1 : 0.5,
                  transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  fontFamily: APPLE_FONT,
                }}
                onMouseEnter={(e) => {
                  if (!project.ready) return;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                }}
              >
                {/* Icon tile */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${project.accentColor}12`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                  }}
                >
                  <Icon size={22} color={project.accentColor} strokeWidth={2.2} />
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: '#1d1d1f',
                    margin: 0,
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {project.name}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: '#6e6e73',
                    margin: 0,
                    paddingRight: 24,
                  }}
                >
                  {project.description}
                </p>

                {/* Footer row */}
                <div
                  style={{
                    marginTop: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: project.accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {project.ready ? 'เปิดใช้งาน' : 'เร็วๆ นี้'}
                    {project.ready && <ArrowRight size={14} />}
                  </span>
                  {project.ready && !isAuthed && (
                    <span
                      style={{
                        fontSize: 11,
                        color: '#6e6e73',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <LockIcon size={11} /> Login
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '24px 22px',
          textAlign: 'center',
          fontSize: 12,
          color: '#86868b',
        }}
      >
        <Link href="/" style={{ color: '#515154', textDecoration: 'none' }}>
          เลือกจากบริษัท (Legacy)
        </Link>
        <span style={{ margin: '0 8px', color: '#d2d2d7' }}>·</span>
        <span>EA Safety & Environment © 2026</span>
      </footer>

      {/* Apple-style Login Modal */}
      {loginFor && (
        <div
          onClick={() => setLoginFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: APPLE_FONT,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 20,
              padding: '28px 28px 24px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/ea-logo.svg" alt="EA" style={{ height: 24 }} />
                <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
                  เข้าสู่ระบบ
                </h2>
              </div>
              <button
                onClick={() => setLoginFor(null)}
                style={{ background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#6e6e73', marginTop: 4, marginBottom: 20 }}>
              เพื่อใช้งาน{' '}
              <strong style={{ color: '#1d1d1f', fontWeight: 600 }}>
                {PROJECTS.find((p) => p.id === loginFor)?.name}
              </strong>
            </p>

            {/* Segmented control */}
            <div
              style={{
                display: 'flex',
                gap: 2,
                background: '#f2f2f7',
                padding: 3,
                borderRadius: 10,
                marginBottom: 18,
              }}
            >
              {(['admin', 'company'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setLoginMode(mode); setLoginError(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: loginMode === mode ? 600 : 500,
                    background: loginMode === mode ? '#fff' : 'transparent',
                    color: loginMode === mode ? '#1d1d1f' : '#6e6e73',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    boxShadow: loginMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 150ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {mode === 'admin' ? <Key size={13} /> : <Building2 size={13} />}
                  {mode === 'admin' ? 'Admin' : 'ผู้ใช้บริษัท'}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loginMode === 'company' && (
                <LabeledInput label="บริษัท" icon={Building2}>
                  <select
                    value={loginCompanyId}
                    onChange={(e) => setLoginCompanyId(e.target.value)}
                    required
                    style={inputStyle()}
                  >
                    <option value="">-- เลือกบริษัทของคุณ --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.fullName || c.name}
                      </option>
                    ))}
                  </select>
                </LabeledInput>
              )}
              <LabeledInput label={loginMode === 'admin' ? 'Admin Username' : 'Username'} icon={User}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle()}
                />
              </LabeledInput>
              <LabeledInput label="Password" icon={Lock}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle()}
                />
              </LabeledInput>

              {loginError && (
                <div
                  style={{
                    fontSize: 13,
                    color: '#d70015',
                    background: '#fff5f5',
                    border: '1px solid #ffe5e5',
                    borderRadius: 10,
                    padding: '8px 12px',
                  }}
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  marginTop: 4,
                  background: loginLoading ? '#a9a9ac' : '#0071e3',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 500,
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: 12,
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => { if (!loginLoading) e.currentTarget.style.background = '#0077ed'; }}
                onMouseLeave={(e) => { if (!loginLoading) e.currentTarget.style.background = '#0071e3'; }}
              >
                {loginLoading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px 10px 36px',
    fontSize: 14,
    fontFamily: APPLE_FONT,
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 10,
    background: '#fff',
    color: '#1d1d1f',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };
}

function LabeledInput({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 12, color: '#6e6e73', display: 'block', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ position: 'relative', display: 'block' }}>
        <Icon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
        {children}
      </span>
    </label>
  );
}
