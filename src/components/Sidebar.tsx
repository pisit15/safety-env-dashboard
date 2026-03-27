'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PROJECTS = [
  { id: 'action-plan', label: 'แผนงานประจำปี', icon: '📋', href: '/' },
  { id: 'incidents', label: 'สถิติอุบัติเหตุ', icon: '🚨', href: '/incidents' },
  { id: 'training', label: 'แผนอบรมประจำปี', icon: '🎓', href: '/training' },
  { id: 'risk', label: 'ประเมินความเสี่ยง', icon: '⚠️', href: '/risk' },
  { id: 'nearmiss', label: 'Near Miss Report', icon: '📝', href: '/nearmiss' },
  { id: 'fire-ext', label: 'ตรวจถังดับเพลิง', icon: '🧯', href: '/fire-ext' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} bg-card border-r border-border flex-shrink-0 flex flex-col transition-all duration-200 h-screen sticky top-0`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏭</span>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Safety & Env</h1>
              <p className="text-xs text-muted">Dashboard</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 text-xs text-muted hover:text-white transition-colors"
        >
          {collapsed ? '→' : '← ย่อเมนู'}
        </button>
      </div>

      {/* Projects navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className={`text-[10px] uppercase tracking-wider text-muted px-3 py-2 ${collapsed ? 'hidden' : ''}`}>
          Projects
        </p>
        {PROJECTS.map((p) => {
          const isActive = pathname === p.href || (p.href !== '/' && pathname.startsWith(p.href));
          return (
            <Link key={p.id} href={p.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span className="text-base">{p.icon}</span>
                {!collapsed && <span>{p.label}</span>}
              </div>
            </Link>
          );
        })}

        <div className={`border-t border-border mt-3 pt-3 ${collapsed ? 'hidden' : ''}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted px-3 py-2">
            จัดการ
          </p>
          <Link href="/admin">
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                pathname === '/admin'
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span className="text-base">⚙️</span>
              <span>Admin / ตั้งค่า</span>
            </div>
          </Link>
        </div>
      </div>

      {/* User info */}
      <div className={`p-3 border-t border-border ${collapsed ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
            HQ
          </div>
          <div>
            <p className="text-xs font-medium text-white">HSE HQ Admin</p>
            <p className="text-[10px] text-muted">กลุ่มบริษัท EA</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
