'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PROJECTS = [
  { id: 'action-plan', label: 'แผนงานประจำปี', icon: '📋', href: '/' },
  { id: 'training', label: 'แผนอบรมประจำปี', icon: '🎓', href: '/training' },
  { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: '🚨', href: '/incidents' },
  { id: 'safety-patrol', label: 'Safety Patrol', icon: '🔍', href: '/safety-patrol' },
  { id: 'risk', label: 'ประเมินความเสี่ยง', icon: '⚠️', href: '/risk' },
  { id: 'nearmiss', label: 'Near Miss Report', icon: '📝', href: '/nearmiss' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-[68px]' : 'w-[260px]'} flex-shrink-0 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] h-screen sticky top-0`}
      style={{
        background: 'linear-gradient(180deg, rgba(14,16,30,0.95) 0%, rgba(8,10,20,0.98) 100%)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #0a84ff 0%, #5ac8fa 100%)' }}>
              🛡️
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-white tracking-tight leading-tight">Safety & Env</h1>
              <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Dashboard</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #0a84ff 0%, #5ac8fa 100%)' }}>
              🛡️
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-3 text-[11px] font-medium transition-colors hover:text-white/70"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {collapsed ? '→' : '← ย่อเมนู'}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Projects navigation */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        <p className={`text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2 ${collapsed ? 'hidden' : ''}`}
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          Projects
        </p>
        <div className="space-y-0.5">
          {PROJECTS.map((p) => {
            const isActive = pathname === p.href || (p.href !== '/' && pathname.startsWith(p.href));
            return (
              <Link key={p.id} href={p.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${
                    isActive
                      ? 'text-[#0a84ff] font-semibold'
                      : 'text-white/55 hover:text-white/85 hover:bg-white/5'
                  }`}
                  style={isActive ? { background: 'rgba(10, 132, 255, 0.15)', boxShadow: 'inset 0 0 20px rgba(10, 132, 255, 0.1)' } : {}}
                >
                  <span className="text-[16px] flex-shrink-0">{p.icon}</span>
                  {!collapsed && <span className="truncate">{p.label}</span>}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Management section */}
        <div className={`mt-5 pt-4 ${collapsed ? 'hidden' : ''}`}>
          <div className="mx-3 mb-3 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-[10px] uppercase tracking-[0.1em] font-semibold px-3 pb-2"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            จัดการ
          </p>
          <Link href="/admin">
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 ${
                pathname === '/admin'
                  ? 'text-[#0a84ff] font-semibold'
                  : 'text-white/55 hover:text-white/85 hover:bg-white/5'
              }`}
              style={pathname === '/admin' ? { background: 'rgba(10, 132, 255, 0.15)', boxShadow: 'inset 0 0 20px rgba(10, 132, 255, 0.1)' } : {}}
            >
              <span className="text-[16px]">⚙️</span>
              <span>Admin / ตั้งค่า</span>
            </div>
          </Link>
        </div>
      </div>

      {/* User info */}
      <div className={`p-4 ${collapsed ? 'hidden' : ''}`}
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #0a84ff 0%, #5856d6 100%)' }}>
            HQ
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white leading-tight">HSE HQ Admin</p>
            <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>กลุ่มบริษัท EA</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
