'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { PROJECTS, type ProjectId } from '@/lib/projects';
import { LogIn, X, User, Lock, ArrowRight, Loader2, Key, Building2, Lock as LockIcon, Eye, EyeOff, Sparkles } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

      {/* Premium Login Modal — Apple-inspired with project identity */}
      {loginFor && (() => {
        const activeProject = PROJECTS.find((p) => p.id === loginFor);
        const accent = activeProject?.accentColor || '#0071e3';
        const ProjectIcon = activeProject?.icon;
        return (
        <div
          onClick={() => setLoginFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: APPLE_FONT,
            animation: 'fadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.94) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .premium-modal input:focus, .premium-modal select:focus {
              outline: none;
              border-color: ${accent}cc !important;
              box-shadow: 0 0 0 4px ${accent}18 !important;
            }
          `}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            className="premium-modal"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 440,
              background: '#fff',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 40px 100px -20px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.08)',
              animation: 'scaleIn 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Decorative gradient top bar */}
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, ${accent}, ${accent}88, ${accent})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
              }}
            />

            {/* Decorative accent blur */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -60,
                right: -60,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Close button */}
            <button
              onClick={() => setLoginFor(null)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: 15,
                color: '#6e6e73',
                cursor: 'pointer',
                zIndex: 2,
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div style={{ padding: '40px 36px 32px', position: 'relative' }}>
              {/* Project identity */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
                {ProjectIcon && (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 18,
                      background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
                      border: `1px solid ${accent}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      position: 'relative',
                    }}
                  >
                    <ProjectIcon size={28} color={accent} strokeWidth={2.2} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <img src="/ea-logo.svg" alt="EA" style={{ height: 18, opacity: 0.9 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#86868b', textTransform: 'uppercase' }}>
                    EA Safety & Environment
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#1d1d1f',
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  {activeProject?.name}
                </h2>
                <p style={{ fontSize: 13, color: '#86868b', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
                  เข้าสู่ระบบเพื่อใช้งาน
                </p>
              </div>

              {/* Segmented control */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3,
                  background: '#f5f5f7',
                  padding: 3,
                  borderRadius: 11,
                  marginBottom: 20,
                  position: 'relative',
                }}
              >
                {(['admin', 'company'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setLoginMode(mode); setLoginError(''); }}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      fontWeight: loginMode === mode ? 600 : 500,
                      background: loginMode === mode ? '#fff' : 'transparent',
                      color: loginMode === mode ? '#1d1d1f' : '#6e6e73',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      boxShadow: loginMode === mode ? '0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontFamily: APPLE_FONT,
                    }}
                  >
                    {mode === 'admin' ? <Key size={13} /> : <Building2 size={13} />}
                    {mode === 'admin' ? 'Admin' : 'ผู้ใช้บริษัท'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {loginMode === 'company' && (
                  <PremiumInput
                    label="บริษัท"
                    icon={Building2}
                    isFocused={focusedField === 'company'}
                  >
                    <select
                      value={loginCompanyId}
                      onChange={(e) => setLoginCompanyId(e.target.value)}
                      onFocus={() => setFocusedField('company')}
                      onBlur={() => setFocusedField(null)}
                      required
                      style={premiumInputStyle()}
                    >
                      <option value="">-- เลือกบริษัทของคุณ --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.fullName || c.name}
                        </option>
                      ))}
                    </select>
                  </PremiumInput>
                )}

                <PremiumInput
                  label={loginMode === 'admin' ? 'Admin Username' : 'Username'}
                  icon={User}
                  isFocused={focusedField === 'username'}
                >
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    required
                    autoFocus
                    style={premiumInputStyle()}
                  />
                </PremiumInput>

                <PremiumInput
                  label="Password"
                  icon={Lock}
                  isFocused={focusedField === 'password'}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#86868b',
                        cursor: 'pointer',
                        padding: 6,
                        display: 'flex',
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    style={{ ...premiumInputStyle(), paddingRight: 40 }}
                  />
                </PremiumInput>

                {loginError && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#d70015',
                      background: 'linear-gradient(180deg, #fff5f5 0%, #fff9f9 100%)',
                      border: '1px solid #ffd5d5',
                      borderRadius: 11,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      animation: 'scaleIn 200ms ease',
                    }}
                  >
                    <X size={14} style={{ color: '#d70015' }} />
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    marginTop: 8,
                    background: loginLoading ? '#a9a9ac' : `linear-gradient(180deg, ${accent} 0%, ${accent}dd 100%)`,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    padding: '14px 16px',
                    border: 'none',
                    borderRadius: 14,
                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: loginLoading ? 'none' : `0 8px 24px -8px ${accent}88, 0 2px 4px rgba(0,0,0,0.06)`,
                    fontFamily: APPLE_FONT,
                    transform: loginLoading ? 'scale(0.98)' : 'scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    if (loginLoading) return;
                    e.currentTarget.style.transform = 'translateY(-1px) scale(1.01)';
                    e.currentTarget.style.boxShadow = `0 14px 32px -10px ${accent}99, 0 2px 4px rgba(0,0,0,0.08)`;
                  }}
                  onMouseLeave={(e) => {
                    if (loginLoading) return;
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = `0 8px 24px -8px ${accent}88, 0 2px 4px rgba(0,0,0,0.06)`;
                  }}
                >
                  {loginLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      เข้าสู่ระบบ
                    </>
                  )}
                </button>

                <p style={{ fontSize: 11, color: '#86868b', textAlign: 'center', marginTop: 4, marginBottom: 0 }}>
                  การเข้าใช้งานถือว่ายอมรับเงื่อนไขการใช้งานของ EA
                </p>
              </form>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function premiumInputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px 12px 40px',
    fontSize: 14,
    fontFamily: APPLE_FONT,
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    background: '#fafafa',
    color: '#1d1d1f',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
  };
}

function PremiumInput({
  label,
  icon: Icon,
  isFocused,
  rightSlot,
  children,
}: {
  label: string;
  icon: React.ElementType;
  isFocused?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          fontSize: 11,
          color: isFocused ? '#1d1d1f' : '#6e6e73',
          display: 'block',
          marginBottom: 6,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          transition: 'color 150ms ease',
        }}
      >
        {label}
      </span>
      <span style={{ position: 'relative', display: 'block' }}>
        <Icon
          size={15}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: isFocused ? '#1d1d1f' : '#86868b',
            transition: 'color 150ms ease',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        {children}
        {rightSlot}
      </span>
    </label>
  );
}
