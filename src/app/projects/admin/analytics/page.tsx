'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import ExportPdfButton from '@/components/ExportPdfButton';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ShieldAlert,
  BarChart3,
  Activity,
  GraduationCap,
  Calendar,
  Building2,
} from 'lucide-react';

const APPLE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif`;

const P = {
  light: {
    bg: '#fbfbfd', text: '#1d1d1f', muted: '#6e6e73', mutedLight: '#86868b',
    navBg: 'rgba(251,251,253,0.85)', navBorder: 'rgba(0,0,0,0.06)', divider: 'rgba(0,0,0,0.15)',
    cardBg: '#fff', cardBorder: 'rgba(0,0,0,0.06)', cardShadow: '0 1px 3px rgba(0,0,0,0.06)',
    sectionBg: '#f5f5f7',
    greenBg: 'rgba(52,199,89,0.08)', greenText: '#248a3d',
    redBg: 'rgba(255,59,48,0.08)', redText: '#d70015',
    yellowBg: 'rgba(255,204,0,0.08)', yellowText: '#a05a00',
    blueBg: 'rgba(0,122,255,0.08)', blueText: '#0a84ff',
  },
  dark: {
    bg: '#000', text: '#f5f5f7', muted: '#a1a1a6', mutedLight: '#86868b',
    navBg: 'rgba(20,20,22,0.85)', navBorder: 'rgba(255,255,255,0.08)', divider: 'rgba(255,255,255,0.15)',
    cardBg: '#1c1c1e', cardBorder: 'rgba(255,255,255,0.08)', cardShadow: '0 1px 3px rgba(0,0,0,0.3)',
    sectionBg: '#1c1c1e',
    greenBg: 'rgba(48,209,88,0.12)', greenText: '#30d158',
    redBg: 'rgba(255,69,58,0.12)', redText: '#ff453a',
    yellowBg: 'rgba(255,214,10,0.12)', yellowText: '#ffd60a',
    blueBg: 'rgba(10,132,255,0.12)', blueText: '#0a84ff',
  },
};

// Chart color palette (data-viz best practice: muted defaults, bold accents)
const CHART = {
  primary: '#4E79A7',
  secondary: '#F28E2B',
  accent: '#E15759',
  positive: '#59A14F',
  neutral: '#BAB0AC',
  categorical: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AnalyticsData {
  years: number[];
  yearlyTrends: any[];
  monthlyTrends: any[];
  safetyRates: any[];
  benchmark: any[];
  incidentPatterns: any;
  trainingByYear: any[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const auth = useAuth();
  const { companies, getCompanyById } = useCompanies();
  const { resolvedTheme } = useTheme();
  const p = resolvedTheme === 'dark' ? P.dark : P.light;
  const isDark = resolvedTheme === 'dark';

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const defaultYears = [currentYear - 2, currentYear - 1, currentYear];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics?years=${defaultYears.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!auth.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: APPLE_FONT, background: p.bg, color: p.text }}>
        <p>เฉพาะ Admin เท่านั้น</p>
      </div>
    );
  }

  const companyName = (id: string) => {
    const c = getCompanyById(id);
    return c?.name || c?.id || id;
  };

  const companyShort = (id: string) => {
    const name = companyName(id);
    // Use first 2 words or max 12 chars
    const words = name.split(/[\s/]+/);
    if (words.length >= 2) return words.slice(0, 2).join(' ').slice(0, 14);
    return name.slice(0, 12);
  };

  // ── Helper: YoY change ──
  const yoyChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const ChangeIndicator = ({ current, previous, invertColor = false }: { current: number; previous: number; invertColor?: boolean }) => {
    const pct = yoyChange(current, previous);
    const isUp = pct > 0;
    const isDown = pct < 0;
    // For safety metrics: decrease = good (green), increase = bad (red)
    // invertColor flips this for metrics where increase is good (e.g., training)
    let color = p.muted;
    let bg = 'transparent';
    if (isUp) { color = invertColor ? p.greenText : p.redText; bg = invertColor ? p.greenBg : p.redBg; }
    if (isDown) { color = invertColor ? p.redText : p.greenText; bg = invertColor ? p.redBg : p.greenBg; }
    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color, background: bg, padding: '2px 8px', borderRadius: 6 }}>
        <Icon size={12} /> {pct > 0 ? '+' : ''}{pct}%
      </span>
    );
  };

  // ── Card wrapper ──
  const Card = ({ children, title, subtitle, span = 1 }: { children: React.ReactNode; title: string; subtitle?: string; span?: number }) => (
    <div style={{
      background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 16,
      padding: 24, boxShadow: p.cardShadow,
      gridColumn: span > 1 ? `span ${span}` : undefined,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: p.text, margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: p.muted, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );

  // ── Horizontal bar chart ──
  const HBar = ({ items, maxVal, colorFn }: { items: { label: string; value: number; sub?: string }[]; maxVal: number; colorFn?: (i: number) => string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: p.text, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 12, color: p.muted, fontWeight: 600 }}>{item.value.toLocaleString()}{item.sub ? ` ${item.sub}` : ''}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%`,
              background: colorFn ? colorFn(i) : CHART.categorical[i % CHART.categorical.length],
              transition: 'width 600ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Vertical bar chart (grouped) ──
  const GroupedBarChart = ({ data: chartData, keys, colors, labels }: {
    data: { label: string; values: number[] }[];
    keys: string[];
    colors: string[];
    labels?: string[];
  }) => {
    const allVals = chartData.flatMap(d => d.values);
    const maxVal = Math.max(...allVals, 1);
    const barH = 160;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barH + 30, paddingTop: 10 }}>
          {chartData.map((group, gi) => (
            <div key={gi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barH }}>
                {group.values.map((val, vi) => (
                  <div key={vi} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {val > 0 && (
                      <span style={{ fontSize: 9, color: p.muted, fontWeight: 600, marginBottom: 2 }}>{val.toLocaleString()}</span>
                    )}
                    <div style={{
                      width: Math.max(16, Math.floor(80 / keys.length)),
                      height: Math.max(2, (val / maxVal) * (barH - 20)),
                      background: colors[vi],
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 600ms ease',
                    }} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 10, color: p.muted, marginTop: 6, textAlign: 'center' }}>{group.label}</span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {(labels || keys).map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i] }} />
              <span style={{ fontSize: 11, color: p.muted }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Line-style area chart (using CSS) ──
  const SparkArea = ({ data: pts, color, height = 80 }: { data: number[]; color: string; height?: number }) => {
    if (!pts.length) return null;
    const max = Math.max(...pts, 1);
    const w = 100;
    const points = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${height - (v / max) * (height - 10)}`).join(' ');
    const areaPoints = `0,${height} ${points} ${w},${height}`;
    return (
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((v, i) => (
          <circle key={i} cx={(i / (pts.length - 1)) * w} cy={height - (v / max) * (height - 10)} r="2.5" fill={color} />
        ))}
      </svg>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: p.bg, fontFamily: APPLE_FONT, color: p.text, transition: 'background 200ms' }}>
      {/* ── Top nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: p.navBg, backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${p.navBorder}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/projects/admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#0a84ff', fontSize: 14, fontWeight: 500, padding: '6px 10px', borderRadius: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,132,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <ArrowLeft size={16} /> Admin Dashboard
            </button>
            <div style={{ height: 20, width: 1, background: p.divider }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: p.text }}>
              <Activity size={16} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
              Advanced Analytics
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle size="sm" />
            <button onClick={fetchData} disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: p.muted, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {data && (
              <ExportPdfButton
                targetId="analytics-content"
                filename={`EA-SHE-Analytics-${data.years.join('-')}`}
                title="EA SHE Advanced Analytics"
                subtitle={`วิเคราะห์ข้อมูลข้ามปี ${data.years[0]}–${data.years[data.years.length - 1]} · ${companies.length} บริษัท`}
                orientation="landscape"
                compact
              />
            )}
          </div>
        </div>
      </header>

      <main id="analytics-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 22px 80px' }}>
        {/* ── Hero ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            วิเคราะห์ข้อมูลเชิงลึก
          </h1>
          <p style={{ fontSize: 15, color: p.muted, margin: '6px 0 0' }}>
            เปรียบเทียบรายปี · Safety Rates · Benchmark ระหว่างบริษัท
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: p.muted }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: 60, color: p.redText }}>
            <p>{error}</p>
            <button onClick={fetchData} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: '#0a84ff', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              ลองใหม่
            </button>
          </div>
        )}

        {data && !loading && (() => {
          const trends = data.yearlyTrends;
          const latestIdx = trends.length - 1;
          const prevIdx = latestIdx - 1;
          const latest = trends[latestIdx];
          const prev = prevIdx >= 0 ? trends[prevIdx] : null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 1: Year-over-Year KPI Summary       */}
              {/* ════════════════════════════════════════════ */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Near Miss', icon: ShieldAlert, value: latest.nearMiss.total, prev: prev?.nearMiss.total, color: CHART.accent },
                  { label: 'อุบัติเหตุ', icon: Activity, value: latest.incidents.total, prev: prev?.incidents.total, color: CHART.secondary },
                  { label: 'แผนฝึกอบรม', icon: GraduationCap, value: latest.training.plans, prev: prev?.training.plans, color: CHART.primary, invert: true },
                  { label: 'ผู้เข้าอบรม', icon: GraduationCap, value: latest.training.attendees, prev: prev?.training.attendees, color: CHART.positive, invert: true },
                  { label: 'ชม.ทำงานรวม', icon: Calendar, value: latest.manhours.total, prev: prev?.manhours.total, color: CHART.neutral, invert: true },
                ].map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={i} style={{
                      background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 14,
                      padding: '18px 20px', boxShadow: p.cardShadow,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: p.muted, fontWeight: 500 }}>{kpi.label}</span>
                        <Icon size={14} style={{ color: kpi.color }} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: p.text }}>
                        {kpi.value.toLocaleString()}
                      </div>
                      {prev !== null && kpi.prev !== undefined && (
                        <div style={{ marginTop: 6 }}>
                          <ChangeIndicator current={kpi.value} previous={kpi.prev} invertColor={!!kpi.invert} />
                          <span style={{ fontSize: 11, color: p.mutedLight, marginLeft: 6 }}>vs {data.years[prevIdx]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 2: Year-over-Year Trend Charts      */}
              {/* ════════════════════════════════════════════ */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                <Card title="Near Miss — เทรนด์รายปี" subtitle="จำนวนรายงาน Near Miss เปรียบเทียบแต่ละปี">
                  <GroupedBarChart
                    data={trends.map((t: any) => ({
                      label: String(t.year),
                      values: [t.nearMiss.total, t.nearMiss.high, t.nearMiss.closed],
                    }))}
                    keys={['total', 'high', 'closed']}
                    colors={[CHART.primary, CHART.accent, CHART.positive]}
                    labels={['ทั้งหมด', 'ความเสี่ยงสูง', 'ปิดแล้ว']}
                  />
                </Card>

                <Card title="อุบัติเหตุ — เทรนด์รายปี" subtitle="จำนวนอุบัติเหตุทั้งหมด vs เกี่ยวกับงาน">
                  <GroupedBarChart
                    data={trends.map((t: any) => ({
                      label: String(t.year),
                      values: [t.incidents.total, t.incidents.workRelated],
                    }))}
                    keys={['total', 'workRelated']}
                    colors={[CHART.secondary, CHART.accent]}
                    labels={['ทั้งหมด', 'เกี่ยวกับงาน']}
                  />
                </Card>
              </div>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 3: Monthly Trend (Latest Year)      */}
              {/* ════════════════════════════════════════════ */}
              {data.monthlyTrends.length > 0 && (() => {
                const latestMonthly = data.monthlyTrends[data.monthlyTrends.length - 1];
                const months = latestMonthly.months;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                    <Card title={`Near Miss รายเดือน — ${latestMonthly.year}`} subtitle="จำนวน Near Miss แต่ละเดือนของปีล่าสุด">
                      <SparkArea data={months.map((m: any) => m.nearMiss)} color={CHART.primary} height={100} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {months.map((m: any, i: number) => (
                          <span key={i} style={{ fontSize: 9, color: p.mutedLight }}>{m.month}</span>
                        ))}
                      </div>
                    </Card>

                    <Card title={`อุบัติเหตุรายเดือน — ${latestMonthly.year}`} subtitle="จำนวนอุบัติเหตุแต่ละเดือนของปีล่าสุด">
                      <SparkArea data={months.map((m: any) => m.incidents)} color={CHART.secondary} height={100} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {months.map((m: any, i: number) => (
                          <span key={i} style={{ fontSize: 9, color: p.mutedLight }}>{m.month}</span>
                        ))}
                      </div>
                    </Card>
                  </div>
                );
              })()}

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 4: Safety Rates (TRIR & LTIFR)      */}
              {/* ════════════════════════════════════════════ */}
              <Card title="อัตราความปลอดภัย (Safety Rates)" subtitle="TRIR, LTIFR, Severity Rate — เทียบรายปี · ต่อ 1,000,000 ชั่วโมงทำงาน">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${p.cardBorder}` }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: p.muted }}>ปี</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>ชม.ทำงาน</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>อุบัติเหตุ</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>บาดเจ็บ</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>LTI</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: CHART.accent }}>TRIR</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: CHART.secondary }}>LTIFR</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: CHART.primary }}>Severity Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.safetyRates.map((sr: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${p.cardBorder}` }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{sr.year}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{sr.overall.manhours.toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{sr.overall.incidents}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{sr.overall.injuries}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{sr.overall.lti}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: CHART.accent }}>{sr.overall.trir}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: CHART.secondary }}>{sr.overall.ltifr}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: CHART.primary }}>{sr.overall.severityRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Sparklines for rates */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>
                  {[
                    { label: 'TRIR Trend', data: data.safetyRates.map((sr: any) => sr.overall.trir), color: CHART.accent },
                    { label: 'LTIFR Trend', data: data.safetyRates.map((sr: any) => sr.overall.ltifr), color: CHART.secondary },
                    { label: 'Severity Rate Trend', data: data.safetyRates.map((sr: any) => sr.overall.severityRate), color: CHART.primary },
                  ].map((item, i) => (
                    <div key={i}>
                      <span style={{ fontSize: 11, color: p.muted, fontWeight: 600 }}>{item.label}</span>
                      <SparkArea data={item.data} color={item.color} height={50} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {data.years.map((y: number) => <span key={y} style={{ fontSize: 9, color: p.mutedLight }}>{y}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 5: Company Benchmark                */}
              {/* ════════════════════════════════════════════ */}
              <Card title="Benchmark ระหว่างบริษัท" subtitle="เปรียบเทียบ Near Miss, อุบัติเหตุ, อัตราปิด Near Miss ของแต่ละบริษัท (ข้อมูลรวมทุกปี)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                  {/* Near Miss by Company */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: '0 0 10px' }}>
                      <ShieldAlert size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                      Near Miss รวม
                    </h4>
                    <HBar
                      items={data.benchmark
                        .sort((a: any, b: any) => b.nearMiss - a.nearMiss)
                        .map((b: any) => ({ label: companyShort(b.companyId), value: b.nearMiss }))}
                      maxVal={Math.max(...data.benchmark.map((b: any) => b.nearMiss), 1)}
                    />
                  </div>

                  {/* Incidents by Company */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: '0 0 10px' }}>
                      <Activity size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                      อุบัติเหตุรวม
                    </h4>
                    <HBar
                      items={data.benchmark
                        .sort((a: any, b: any) => b.incidents - a.incidents)
                        .map((b: any) => ({ label: companyShort(b.companyId), value: b.incidents }))}
                      maxVal={Math.max(...data.benchmark.map((b: any) => b.incidents), 1)}
                      colorFn={() => CHART.secondary}
                    />
                  </div>

                  {/* NM Close Rate */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: '0 0 10px' }}>
                      <BarChart3 size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                      อัตราปิด Near Miss (%)
                    </h4>
                    <HBar
                      items={data.benchmark
                        .sort((a: any, b: any) => b.nearMissCloseRate - a.nearMissCloseRate)
                        .map((b: any) => ({ label: companyShort(b.companyId), value: b.nearMissCloseRate, sub: '%' }))}
                      maxVal={100}
                      colorFn={() => CHART.positive}
                    />
                  </div>

                  {/* Training Hours */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: '0 0 10px' }}>
                      <GraduationCap size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                      ชั่วโมงฝึกอบรมรวม
                    </h4>
                    <HBar
                      items={data.benchmark
                        .sort((a: any, b: any) => b.trainingHours - a.trainingHours)
                        .map((b: any) => ({ label: companyShort(b.companyId), value: Math.round(b.trainingHours), sub: 'ชม.' }))}
                      maxVal={Math.max(...data.benchmark.map((b: any) => b.trainingHours), 1)}
                      colorFn={() => CHART.primary}
                    />
                  </div>
                </div>
              </Card>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 6: Safety Rates by Company (latest) */}
              {/* ════════════════════════════════════════════ */}
              {data.safetyRates.length > 0 && (() => {
                const latestSR = data.safetyRates[data.safetyRates.length - 1];
                const comps = (latestSR.companies as any[]).filter(c => c.manhours > 0);
                if (comps.length === 0) return null;
                return (
                  <Card title={`Safety Rates รายบริษัท — ${latestSR.year}`} subtitle="TRIR, LTIFR ต่อ 1,000,000 ชั่วโมงทำงาน แยกตามบริษัท">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${p.cardBorder}` }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: p.muted }}>บริษัท</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>ชม.ทำงาน</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>อุบัติเหตุ</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: CHART.accent }}>TRIR</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: CHART.secondary }}>LTIFR</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: CHART.primary }}>Severity Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comps.sort((a: any, b: any) => b.trir - a.trir).map((c: any, i: number) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${p.cardBorder}` }}>
                              <td style={{ padding: '12px', fontWeight: 500 }}>
                                <Building2 size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 6, color: CHART.categorical[i % 10] }} />
                                {companyShort(c.companyId)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>{c.manhours.toLocaleString()}</td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>{c.incidents}</td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: c.trir > 0 ? CHART.accent : p.muted }}>{c.trir}</td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: c.ltifr > 0 ? CHART.secondary : p.muted }}>{c.ltifr}</td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: c.severityRate > 0 ? CHART.primary : p.muted }}>{c.severityRate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })()}

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 7: Incident Patterns                */}
              {/* ════════════════════════════════════════════ */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {/* Day of Week */}
                <Card title="อุบัติเหตุตามวันในสัปดาห์" subtitle="จำนวนอุบัติเหตุจำแนกตามวัน (รวมทุกปี)">
                  {(() => {
                    const dow = data.incidentPatterns.dayOfWeek || {};
                    const dayOrder = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์',
                      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
                      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const items = Object.entries(dow)
                      .sort(([a], [b]) => {
                        const ai = dayOrder.indexOf(a);
                        const bi = dayOrder.indexOf(b);
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                      })
                      .map(([day, count]) => ({ label: day, value: count as number }));
                    if (items.length === 0) return <p style={{ color: p.muted, fontSize: 13 }}>ไม่มีข้อมูล</p>;
                    return <HBar items={items} maxVal={Math.max(...items.map(i => i.value), 1)} colorFn={() => CHART.secondary} />;
                  })()}
                </Card>

                {/* Severity Distribution */}
                <Card title="ระดับความรุนแรง (Severity)" subtitle="การกระจายตัวของระดับความรุนแรง (รวมทุกปี)">
                  {(() => {
                    const sev = data.incidentPatterns.severity || {};
                    const items = Object.entries(sev)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([level, count]) => ({ label: level, value: count as number }));
                    if (items.length === 0) return <p style={{ color: p.muted, fontSize: 13 }}>ไม่มีข้อมูล</p>;
                    return <HBar items={items} maxVal={Math.max(...items.map(i => i.value), 1)} />;
                  })()}
                </Card>

                {/* Cost by Year */}
                <Card title="ค่าใช้จ่ายจากอุบัติเหตุ" subtitle="Direct + Indirect Cost รวมตามปี (บาท)">
                  {(() => {
                    const costData = data.incidentPatterns.costByYear || {};
                    const items = data.years.map((y: number) => ({
                      label: String(y),
                      value: Math.round(costData[y] || 0),
                      sub: '฿',
                    }));
                    const maxVal = Math.max(...items.map((i: any) => i.value), 1);
                    return <HBar items={items} maxVal={maxVal} colorFn={() => CHART.accent} />;
                  })()}
                </Card>
              </div>

              {/* ════════════════════════════════════════════ */}
              {/* SECTION 8: Training Overview                */}
              {/* ════════════════════════════════════════════ */}
              <Card title="ภาพรวมการฝึกอบรม" subtitle="แผนฝึกอบรม, จำนวน session, อัตราเสร็จสิ้น, ค่าใช้จ่าย เปรียบเทียบรายปี">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${p.cardBorder}` }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: p.muted }}>ปี</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>แผน</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>Sessions</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: CHART.positive }}>เสร็จสิ้น</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: CHART.primary }}>อัตราสำเร็จ</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>ชม.อบรมรวม</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.muted }}>ค่าใช้จ่าย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trainingByYear.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${p.cardBorder}` }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{t.year}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{t.plans}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{t.sessions}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: CHART.positive, fontWeight: 600 }}>{t.completedSessions}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              background: t.completionRate >= 80 ? p.greenBg : t.completionRate >= 50 ? p.yellowBg : p.redBg,
                              color: t.completionRate >= 80 ? p.greenText : t.completionRate >= 50 ? p.yellowText : p.redText,
                            }}>
                              {t.completionRate}%
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{t.totalSessionHours.toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{t.totalCost.toLocaleString()} ฿</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          );
        })()}
      </main>
    </div>
  );
}
