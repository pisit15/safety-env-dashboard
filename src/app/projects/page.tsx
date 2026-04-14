'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { PROJECTS, type ProjectId } from '@/lib/projects';
import { Shield, LogIn, X, User, Lock, ArrowRight, Loader2, Key, Building2 } from 'lucide-react';

export default function ProjectsLandingPage() {
  const router = useRouter();
  const auth = useAuth();
  const { companies } = useCompanies();

  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  // Resolve the right landing URL for a project based on user role:
  // - Admin → project HQ overview (cid='all')
  // - Company user → their own company page (cid=<their companyId>)
  // - Fallback → project hub
  const resolveProjectUrl = (projectId: ProjectId, overrideCompanyId?: string) => {
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return `/projects/${projectId}`;
    const firstNav = project.nav[0];
    if (!firstNav) return `/projects/${projectId}`;
    // Decide active companyId
    let cid = 'all';
    if (overrideCompanyId) {
      cid = overrideCompanyId;
    } else if (!auth.isAdmin) {
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
    if (isAuthed) {
      router.push(resolveProjectUrl(projectId));
    } else {
      setLoginFor(projectId);
      setLoginError('');
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
            <Shield size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Safety & Environment Dashboard</h1>
            <p className="text-xs text-blue-200">eashe.org</p>
          </div>
        </div>
        {isAuthed ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-200 hidden sm:inline">
              {auth.isAdmin ? `Admin: ${auth.adminName}` : 'ผู้ใช้บริษัท'}
            </span>
            <button
              onClick={() => {
                if (auth.isAdmin) auth.adminLogout();
                Object.keys(auth.companyAuth).forEach((cid) => auth.companyLogout(cid));
                router.refresh();
              }}
              className="text-sm text-blue-200 hover:text-white transition"
            >
              ออกจากระบบ
            </button>
          </div>
        ) : null}
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto text-center px-6 pt-8 pb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          เลือกโครงการที่ต้องการใช้งาน
        </h2>
        <p className="text-lg text-blue-200">
          บริหารจัดการด้านความปลอดภัยและสิ่งแวดล้อม ครบวงจร 13 บริษัทในเครือ EA
        </p>
      </div>

      {/* Project grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROJECTS.map((project) => {
          const Icon = project.icon;
          return (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              disabled={!project.ready}
              className={`group relative overflow-hidden rounded-xl bg-white/5 backdrop-blur border border-white/10 p-6 text-left transition-all ${
                project.ready
                  ? 'hover:bg-white/10 hover:border-white/30 hover:-translate-y-1 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${project.color}`} />
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${project.color} mb-4`}>
                <Icon size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                {project.name}
                {project.ready && (
                  <ArrowRight
                    size={16}
                    className="text-white/50 group-hover:text-white group-hover:translate-x-1 transition"
                  />
                )}
              </h3>
              <p className="text-sm text-blue-200/80 leading-relaxed">
                {project.description}
              </p>
              {!project.ready && (
                <span className="absolute top-4 right-4 text-xs bg-white/10 text-white/70 px-2 py-1 rounded">
                  Coming Soon
                </span>
              )}
              {project.ready && !isAuthed && (
                <span className="absolute top-4 right-4 text-xs bg-yellow-400/20 text-yellow-200 px-2 py-1 rounded flex items-center gap-1">
                  <Lock size={10} /> Login
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="text-center pb-8 text-xs text-blue-300/60">
        <Link href="/" className="hover:text-white transition">
          ← เลือกจากบริษัท (Legacy)
        </Link>
        <span className="mx-2">·</span>
        <span>EA SHE © 2026</span>
      </footer>

      {/* Login Modal */}
      {loginFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur p-4" onClick={() => setLoginFor(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Key size={20} className="text-blue-600" />
                เข้าสู่ระบบ
              </h3>
              <button
                onClick={() => setLoginFor(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              เพื่อใช้งาน{' '}
              <strong className="text-gray-900">
                {PROJECTS.find((p) => p.id === loginFor)?.name}
              </strong>
            </p>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setLoginMode('admin'); setLoginError(''); }}
                className={`flex-1 py-2 px-3 text-sm rounded-md transition ${loginMode === 'admin' ? 'bg-white text-gray-900 shadow font-semibold' : 'text-gray-600'}`}
              >
                <Key size={14} className="inline mr-1" /> Admin
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('company'); setLoginError(''); }}
                className={`flex-1 py-2 px-3 text-sm rounded-md transition ${loginMode === 'company' ? 'bg-white text-gray-900 shadow font-semibold' : 'text-gray-600'}`}
              >
                <Building2 size={14} className="inline mr-1" /> ผู้ใช้บริษัท
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              {loginMode === 'company' && (
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">บริษัท</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={loginCompanyId}
                      onChange={(e) => setLoginCompanyId(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm appearance-none bg-white"
                    >
                      <option value="">-- เลือกบริษัทของคุณ --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.fullName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-600 mb-1 block">{loginMode === 'admin' ? 'Admin Username' : 'Username'}</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>
              {loginError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loginLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
