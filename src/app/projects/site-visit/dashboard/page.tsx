'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import { COMPANIES } from '@/lib/companies';
import { BarChart3, Building2, TrendingUp, Shield, Leaf, Calendar, ChevronDown } from 'lucide-react';

const VIZ = {
  primary: '#14b8a6',
  secondary: '#F28E2B',
  accent: '#E15759',
  positive: '#59A14F',
  neutral: '#BAB0AC',
  muted: '#D4D4D4',
  text: '#333333',
  lightText: '#666666',
};

interface Category {
  id: number;
  parent_type: string;
  name: string;
  name_th: string;
  sort_order: number;
}

interface CategoryScore {
  category_id: number;
  score: number;
  max_score: number;
  count: number;
  percent: number;
}

interface AssessmentSummary {
  assessment_id: number;
  company_id: string;
  assessment_date: string;
  assessment_type: string;
  assessor_name: string;
  total_score: number;
  max_possible_score: number;
  categories: CategoryScore[];
}

interface SummaryData {
  assessments: Array<{
    id: number;
    company_id: string;
    assessment_type: string;
    assessment_date: string;
    assessor_name: string;
    status: string;
    total_score: number;
    max_possible_score: number;
  }>;
  categoryScores: AssessmentSummary[];
  categories: Category[];
  companies: string[];
}

export default function SiteVisitDashboard() {
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const router = useRouter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);

  useEffect(() => {
    if (!isAdmin) router.push('/');
  }, [isAdmin, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCompany !== 'all' ? `?company_id=${filterCompany}` : '';
      const res = await fetch(`/api/site-visit/summary${params}`);
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isAdmin) return null;

  const getCompanyName = (cid: string) => {
    const c = COMPANIES.find(x => x.id === cid);
    return c?.name || cid.toUpperCase();
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return VIZ.positive;
    if (pct >= 60) return VIZ.secondary;
    return VIZ.accent;
  };

  const safetyCategories = (data?.categories || []).filter(c => c.parent_type === 'safety');
  const enviCategories = (data?.categories || []).filter(c => c.parent_type === 'environment');

  // Aggregate category scores across all assessments (latest per company)
  const latestByCompany = new Map<string, AssessmentSummary>();
  for (const s of data?.categoryScores || []) {
    const existing = latestByCompany.get(s.company_id);
    if (!existing || s.assessment_date > existing.assessment_date) {
      latestByCompany.set(s.company_id, s);
    }
  }
  const latestAssessments = Array.from(latestByCompany.values());

  // Average scores per category across latest assessments
  const categoryAverages = (cats: Category[]) => {
    return cats.map(cat => {
      const scores = latestAssessments
        .map(a => a.categories.find(c => c.category_id === cat.id))
        .filter(Boolean) as CategoryScore[];
      const avgPct = scores.length > 0
        ? Math.round(scores.reduce((s, c) => s + c.percent, 0) / scores.length)
        : 0;
      const totalScore = scores.reduce((s, c) => s + c.score, 0);
      const totalMax = scores.reduce((s, c) => s + c.max_score, 0);
      return { ...cat, avgPct, totalScore, totalMax, assessmentCount: scores.length };
    });
  };

  const safetyAvg = categoryAverages(safetyCategories);
  const enviAvg = categoryAverages(enviCategories);

  const overallPct = latestAssessments.length > 0
    ? Math.round(latestAssessments.reduce((s, a) => s + (a.max_possible_score > 0 ? (a.total_score / a.max_possible_score) * 100 : 0), 0) / latestAssessments.length)
    : 0;

  const safetyOverall = safetyAvg.length > 0 && safetyAvg.some(c => c.assessmentCount > 0)
    ? Math.round(safetyAvg.filter(c => c.assessmentCount > 0).reduce((s, c) => s + c.avgPct, 0) / safetyAvg.filter(c => c.assessmentCount > 0).length)
    : 0;
  const enviOverall = enviAvg.length > 0 && enviAvg.some(c => c.assessmentCount > 0)
    ? Math.round(enviAvg.filter(c => c.assessmentCount > 0).reduce((s, c) => s + c.avgPct, 0) / enviAvg.filter(c => c.assessmentCount > 0).length)
    : 0;

  const BarChart = ({ items, maxLabel }: { items: Array<{ label: string; pct: number; score: number; maxScore: number }>; maxLabel?: string }) => {
    const barH = 28;
    const gap = 6;
    const labelW = 280;
    const chartW = 400;
    const totalH = items.length * (barH + gap);
    return (
      <svg width="100%" viewBox={`0 0 ${labelW + chartW + 120} ${totalH + 10}`} style={{ display: 'block' }}>
        {items.map((item, i) => {
          const y = i * (barH + gap) + 5;
          const w = (item.pct / 100) * chartW;
          const color = getScoreColor(item.pct);
          return (
            <g key={i}>
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize={12} fill={VIZ.text}>
                {item.label.length > 35 ? item.label.substring(0, 35) + '...' : item.label}
              </text>
              <rect x={labelW} y={y} width={chartW} height={barH} rx={4} fill="#f0f0f0" />
              <rect x={labelW} y={y} width={Math.max(w, 2)} height={barH} rx={4} fill={color} opacity={0.85} />
              <text x={labelW + w + 8} y={y + barH / 2 + 4} fontSize={12} fontWeight={600} fill={color}>
                {item.pct}%
              </text>
              <text x={labelW + chartW + 50} y={y + barH / 2 + 4} fontSize={11} fill={VIZ.lightText}>
                {item.score}/{item.maxScore}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: VIZ.text, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <BarChart3 size={28} color={VIZ.primary} />
            Dashboard สรุปผลประเมิน
          </h1>
          <p style={{ color: VIZ.lightText, fontSize: 14 }}>
            ภาพรวมคะแนนประเมินทั้งด้านความปลอดภัยและสิ่งแวดล้อม
          </p>
        </div>

        {/* Company filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCompanyDrop(!showCompanyDrop)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: VIZ.text,
            }}
          >
            <Building2 size={16} color={VIZ.primary} />
            {filterCompany === 'all' ? 'ทุกบริษัท' : getCompanyName(filterCompany)}
            <ChevronDown size={16} color={VIZ.lightText} />
          </button>
          {showCompanyDrop && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 200, maxHeight: 300, overflowY: 'auto',
            }}>
              <div
                onClick={() => { setFilterCompany('all'); setShowCompanyDrop(false); }}
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: filterCompany === 'all' ? 700 : 400, color: filterCompany === 'all' ? VIZ.primary : VIZ.text }}
              >
                ทุกบริษัท
              </div>
              {(data?.companies || []).map(cid => (
                <div
                  key={cid}
                  onClick={() => { setFilterCompany(cid); setShowCompanyDrop(false); }}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: filterCompany === cid ? 700 : 400, color: filterCompany === cid ? VIZ.primary : VIZ.text }}
                >
                  {getCompanyName(cid)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: VIZ.lightText }}>กำลังโหลด...</div>
      ) : !data || data.assessments.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center' }}>
          <BarChart3 size={48} color={VIZ.muted} style={{ marginBottom: 16 }} />
          <p style={{ color: VIZ.lightText, fontSize: 16 }}>ยังไม่มีผลประเมินที่เสร็จสิ้น</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', borderLeft: `4px solid ${VIZ.primary}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText }}>ประเมินเสร็จสิ้น</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: VIZ.primary }}>{data.assessments.length}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', borderLeft: `4px solid ${getScoreColor(overallPct)}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={14} /> คะแนนเฉลี่ยรวม</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(overallPct) }}>{overallPct}%</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', borderLeft: `4px solid ${getScoreColor(safetyOverall)}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText, display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={14} /> ความปลอดภัย</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(safetyOverall) }}>{safetyOverall}%</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', borderLeft: `4px solid ${getScoreColor(enviOverall)}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: VIZ.lightText, display: 'flex', alignItems: 'center', gap: 4 }}><Leaf size={14} /> สิ่งแวดล้อม</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(enviOverall) }}>{enviOverall}%</div>
            </div>
          </div>

          {/* Safety Bar Chart */}
          {safetyAvg.some(c => c.assessmentCount > 0) && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: VIZ.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Shield size={20} color={VIZ.primary} />
                คะแนนด้านความปลอดภัย (Safety) — เฉลี่ย {safetyOverall}%
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <BarChart
                  items={safetyAvg.filter(c => c.assessmentCount > 0).map(c => ({
                    label: `${c.sort_order}. ${c.name_th}`,
                    pct: c.avgPct,
                    score: c.totalScore,
                    maxScore: c.totalMax,
                  }))}
                />
              </div>
            </div>
          )}

          {/* Environment Bar Chart */}
          {enviAvg.some(c => c.assessmentCount > 0) && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: VIZ.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Leaf size={20} color={VIZ.positive} />
                คะแนนด้านสิ่งแวดล้อม (Environment) — เฉลี่ย {enviOverall}%
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <BarChart
                  items={enviAvg.filter(c => c.assessmentCount > 0).map(c => ({
                    label: `${c.sort_order}. ${c.name_th}`,
                    pct: c.avgPct,
                    score: c.totalScore,
                    maxScore: c.totalMax,
                  }))}
                />
              </div>
            </div>
          )}

          {/* Company Comparison Table */}
          {latestAssessments.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: VIZ.text, marginBottom: 20 }}>
                ผลประเมินรายบริษัท (ครั้งล่าสุด)
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>บริษัท</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>วันที่</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>ประเภท</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>คะแนน</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>%</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: VIZ.lightText, fontWeight: 600 }}>ระดับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestAssessments.sort((a, b) => {
                      const aPct = a.max_possible_score > 0 ? (a.total_score / a.max_possible_score) * 100 : 0;
                      const bPct = b.max_possible_score > 0 ? (b.total_score / b.max_possible_score) * 100 : 0;
                      return bPct - aPct;
                    }).map(a => {
                      const pct = a.max_possible_score > 0 ? Math.round((a.total_score / a.max_possible_score) * 100) : 0;
                      const level = pct >= 90 ? 'ดีเยี่ยม' : pct >= 80 ? 'ดี' : pct >= 60 ? 'พอใช้' : 'ต้องปรับปรุง';
                      return (
                        <tr key={a.assessment_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px', fontWeight: 600, color: VIZ.text }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Building2 size={16} color={VIZ.primary} />
                              {getCompanyName(a.company_id)}
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: VIZ.lightText }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <Calendar size={13} /> {a.assessment_date}
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                              background: a.assessment_type === 'admin' ? '#dbeafe' : '#f0fdf4',
                              color: a.assessment_type === 'admin' ? '#2563eb' : '#16a34a',
                            }}>
                              {a.assessment_type === 'admin' ? 'Admin' : 'Self'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: VIZ.text }}>{a.total_score}/{a.max_possible_score}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: getScoreColor(pct), fontSize: 16 }}>{pct}%</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                              background: pct >= 80 ? '#f0fdf4' : pct >= 60 ? '#fffbeb' : '#fef2f2',
                              color: getScoreColor(pct),
                            }}>
                              {level}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
