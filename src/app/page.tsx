'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowRight,
  Shield,
  Key,
  Building2,
  X,
  LogIn,
  User,
  Lock,
  Sun,
  Moon,
  HelpCircle,
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Settings,
  LogOut,
} from 'lucide-react';

interface DbCompanySetting {
  company_id: string;
  bu: string;
}

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const [dbBuMap, setDbBuMap] = useState<Record<string, string>>({});

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Theme toggle
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDark(saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }, []);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  // Login modal state
  const [loginModal, setLoginModal] = useState<{ companyId: string; companyName: string; fullName?: string } | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const openLoginModal = (companyId: string, companyName: string, fullName?: string) => {
    const ca = auth.getCompanyAuth(companyId);
    if (ca.isLoggedIn || auth.isAdmin) {
      router.push(`/company/${companyId}`);
      return;
    }
    setLoginModal({ companyId, companyName, fullName });
    setLoginUser('');
    setLoginPass('');
    setLoginError('');
  };

  const handleCompanyLogin = async () => {
    if (!loginModal || !loginPass) return;
    setLoginLoading(true);
    setLoginError('');
    const result = await auth.companyLogin(loginModal.companyId, loginUser, loginPass);
    setLoginLoading(false);
    if (result.success) {
      setLoginModal(null);
      router.push(`/company/${loginModal.companyId}`);
    } else {
      setLoginError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  // Fetch BU settings from DB
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          const map: Record<string, string> = {};
          data.settings.forEach((s: DbCompanySetting) => {
            map[s.company_id] = s.bu ?? '';
          });
          setDbBuMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Build companies with DB BU overrides
  const companiesWithDbBu = COMPANIES.map(c => ({
    ...c,
    bu: (c.id in dbBuMap ? dbBuMap[c.id] : c.bu) as typeof c.bu,
  }));

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companiesWithDbBu;
    const q = searchQuery.toLowerCase();
    return companiesWithDbBu.filter(c =>
      c.shortName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.fullName || '').toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [companiesWithDbBu, searchQuery]);

  // Group by BU
  const BU_ORDER = ['EV', 'Renewable Energy', 'Biodiesel', 'Waste Management', ''];
  const BU_LABELS: Record<string, string> = {
    'EV': 'EV (ยานยนต์ไฟฟ้า)',
    'Renewable Energy': 'Renewable Energy (พลังงานหมุนเวียน)',
    'Biodiesel': 'Biodiesel (ไบโอดีเซล)',
    'Waste Management': 'Waste Management (จัดการขยะ)',
    '': 'อื่นๆ',
  };
  const BU_COLORS: Record<string, string> = {
    'EV': '#f59e0b',
    'Renewable Energy': '#0ea5e9',
    'Biodiesel': '#16a34a',
    'Waste Management': '#ef4444',
    '': '#9ca3af',
  };

  const grouped = BU_ORDER.map(bu => ({
    bu,
    label: BU_LABELS[bu] || bu || 'อื่นๆ',
    color: BU_COLORS[bu] || '#9ca3af',
    companies: filteredCompanies
      .filter(c => (c.bu || '') === bu)
      .sort((a, b) => a.shortName.localeCompare(b.shortName)),
  })).filter(g => g.companies.length > 0);

  // If admin is logged in, redirect to admin page
  // (They can still come back to this page, but the primary flow sends them to /admin)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Top Bar — minimal: logo + theme + admin link */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--card-solid)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/ea-logo.svg" alt="EA" style={{ height: 28 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Safety & Environment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleTheme}
              style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 6 }}
              title={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {auth.isAdmin ? (
              <Link href="/admin">
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Shield size={14} /> แดชบอร์ดผู้ดูแล
                </button>
              </Link>
            ) : (
              <Link href="/admin">
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  <Key size={14} /> ผู้ดูแลระบบ
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(0,122,255,0.08)', marginBottom: 16 }}>
            <Shield size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>EA Group Safety & Environment Dashboard</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.3 }}>
            ระบบบริหารจัดการความปลอดภัย<br />และสิ่งแวดล้อม
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.6 }}>
            เลือกบริษัทของคุณ &rarr; เข้าสู่ระบบ &rarr; ดูแผนงาน / อบรม / อุบัติเหตุ
          </p>

          {/* Search Box — prominent */}
          <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาบริษัท... ชื่อย่อ, ชื่อเต็ม, หรือรหัส"
              style={{
                width: '100%', padding: '14px 44px 14px 44px', borderRadius: 12, fontSize: 14,
                border: '2px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text-primary)',
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              พบ {filteredCompanies.length} บริษัท {filteredCompanies.length === 0 && '— ลองค้นหาด้วยชื่ออื่น'}
            </p>
          )}
        </div>

        {/* Admin Quick Nav — only visible when admin is logged in */}
        {auth.isAdmin && (
          <div style={{ marginBottom: 28, padding: '20px', borderRadius: 14, background: 'var(--card-solid)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} style={{ color: '#ff9500' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>ภาพรวมผู้ดูแล</span>
              </div>
              <button onClick={() => { auth.adminLogout(); window.location.href = '/'; }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                <LogOut size={12} /> ออกจากระบบ
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Link href="/action-plan" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#007aff'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,122,255,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,122,255,0.1)', flexShrink: 0 }}>
                    <ClipboardList size={17} style={{ color: '#007aff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>แผนงานประจำปี</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ภาพรวมทุกบริษัท</div>
                  </div>
                </div>
              </Link>
              <Link href="/training" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#5856d6'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(88,86,214,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(88,86,214,0.1)', flexShrink: 0 }}>
                    <GraduationCap size={17} style={{ color: '#5856d6' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>แผนอบรมประจำปี</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ภาพรวมทุกบริษัท</div>
                  </div>
                </div>
              </Link>
              <Link href="/incidents" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ff3b30'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(255,59,48,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,59,48,0.1)', flexShrink: 0 }}>
                    <AlertTriangle size={17} style={{ color: '#ff3b30' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>สถิติอุบัติเหตุ</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ภาพรวมทุกบริษัท</div>
                  </div>
                </div>
              </Link>
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ff9500'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(255,149,0,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,149,0,0.1)', flexShrink: 0 }}>
                    <Settings size={17} style={{ color: '#ff9500' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>ตั้งค่าระบบ</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>จัดการสิทธิ์ / ข้อมูล</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Company Grid — grouped by BU */}
        <div style={{ paddingBottom: 40 }}>
          {filteredCompanies.length === 0 && searchQuery ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Building2 size={40} style={{ color: 'var(--border)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>ไม่พบบริษัทที่ตรงกับ &quot;{searchQuery}&quot;</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>ลองค้นหาด้วยชื่อย่อ เช่น AAB, AMT หรือชื่อเต็มเช่น &quot;แบตเตอรี่&quot;</p>
              <button onClick={() => setSearchQuery('')}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ล้างการค้นหา
              </button>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.bu} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 }}>
                  <div style={{ width: 4, height: 20, borderRadius: 2, background: group.color }} />
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {group.label}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>({group.companies.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {group.companies.map((company) => {
                    const ca = auth.getCompanyAuth(company.id);
                    const isLoggedIn = ca.isLoggedIn || auth.isAdmin;
                    return (
                      <button
                        key={company.id}
                        onClick={() => openLoginModal(company.id, company.shortName, company.fullName)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          borderRadius: 10, border: `1px solid ${isLoggedIn ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                          background: isLoggedIn ? 'rgba(22,163,74,0.04)' : 'var(--card-solid)',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'all 0.15s', boxShadow: 'none',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = isLoggedIn ? 'rgba(22,163,74,0.3)' : 'var(--border)'; }}
                        title={`เลือก ${company.shortName} เพื่อเข้าสู่ระบบ`}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#fff',
                          background: `linear-gradient(135deg, ${group.color} 0%, ${group.color}cc 100%)`,
                        }}>
                          {company.shortName.substring(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {company.shortName}
                          </div>
                          {company.fullName && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {company.fullName}
                            </div>
                          )}
                        </div>
                        {isLoggedIn ? (
                          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>เข้าแล้ว</span>
                        ) : (
                          <ArrowRight size={14} style={{ color: 'var(--border)', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Help Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
            <HelpCircle size={14} />
            <span>หาบริษัทไม่เจอ หรือเข้าสู่ระบบไม่ได้? ติดต่อฝ่าย Safety — pisit15@gmail.com</span>
          </div>
        </div>
      </div>

      {/* Login Modal Overlay — don't close on backdrop click if form has data */}
      {loginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            if (!loginUser && !loginPass) setLoginModal(null);
          }}
        >
          <div
            className="rounded-2xl p-0 w-full max-w-[380px] animate-fade-in-up overflow-hidden"
            style={{
              background: '#ffffff',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold"
                    style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                    {loginModal.companyName.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-white">
                      {loginModal.companyName}
                    </h3>
                    {loginModal.fullName && (
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{loginModal.fullName}</p>
                    )}
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>เข้าสู่ระบบผู้ใช้งาน</p>
                  </div>
                </div>
                <button
                  onClick={() => setLoginModal(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <X size={16} style={{ color: '#fff' }} />
                </button>
              </div>
            </div>

            {/* Form body */}
            <div className="px-6 py-5">
              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>ชื่อผู้ใช้</label>
              <div className="relative mb-4">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                <input
                  type="text"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  placeholder="ชื่อผู้ใช้ (ถ้ามี)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }}
                  autoFocus
                />
              </div>

              <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#6b7280' }}>รหัสผ่าน</label>
              <div className="relative mb-4">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
                <input
                  type="password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCompanyLogin()}
                  placeholder="รหัสผ่าน"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827' }}
                />
              </div>

              {loginError && (
                <div className="mb-4 px-3 py-2 rounded-lg text-[12px]" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  {loginError}
                </div>
              )}

              <button
                onClick={handleCompanyLogin}
                disabled={!loginPass || loginLoading}
                className="w-full py-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  background: loginPass ? 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)' : '#e5e7eb',
                  color: loginPass ? '#fff' : '#9ca3af',
                  cursor: loginPass ? 'pointer' : 'not-allowed',
                  opacity: loginLoading ? 0.7 : 1,
                  boxShadow: loginPass ? '0 4px 14px rgba(0,122,255,0.3)' : 'none',
                  border: 'none',
                }}
              >
                {loginLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn size={16} />
                )}
                {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
