'use client';

/**
 * Monthly incident counts compared across years — one line per year.
 * Custom SVG (no external chart libraries).
 */

export interface MonthlyYearSeries {
  year: number;
  counts: number[]; // 12 months, index 0 = Jan
}

interface Props {
  series: MonthlyYearSeries[];
  title?: string;
}

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const YEAR_COLORS: Record<number, string> = {
  2021: '#94a3b8', 2022: '#64748b', 2023: '#8b5cf6',
  2024: '#3b82f6', 2025: '#f97316', 2026: '#ef4444',
};
const FALLBACK_COLORS = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2', '#B07AA1'];
const colorOf = (year: number, i: number) => YEAR_COLORS[year] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];

export default function MonthlyByYearChart({ series, title = 'อุบัติการณ์รายเดือน — เปรียบเทียบระหว่างปี' }: Props) {
  const sorted = [...series].sort((a, b) => a.year - b.year);

  const W = 760, H = 260;
  const padL = 34, padR = 16, padT = 18, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(...sorted.flatMap(s => s.counts), 1);
  const x = (m: number) => padL + (plotW / 11) * m;
  const y = (v: number) => padT + plotH - (v / maxV) * plotH;

  const linePath = (counts: number[]) =>
    counts.map((v, m) => `${m === 0 ? 'M' : 'L'} ${x(m)} ${y(v)}`).join(' ');

  // Y-axis ticks: integers, max 5 ticks
  const step = Math.max(1, Math.ceil(maxV / 4));
  const ticks: number[] = [];
  for (let t = 0; t <= maxV; t += step) ticks.push(t);

  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>จำนวนเหตุการณ์ต่อเดือน · ตามช่วงปีที่เลือกด้านบน</span>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>ไม่มีข้อมูลในช่วงปีที่เลือก</div>
      ) : (
        <>
          {sorted.length === 1 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              เลือกหลายปี (เช่น &ldquo;3 ปีล่าสุด&rdquo;) เพื่อเปรียบเทียบแนวโน้มรายเดือนระหว่างปี
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto' }}>
              {/* Gridlines + Y labels */}
              {ticks.map(t => (
                <g key={t}>
                  <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={padL - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--text-secondary)">{t}</text>
                </g>
              ))}

              {/* Month labels */}
              {MONTH_TH.map((m, i) => (
                <text key={m} x={x(i)} y={H - 12} fontSize={10} textAnchor="middle" fill="var(--text-secondary)">{m}</text>
              ))}

              {/* One line per year */}
              {sorted.map((s, si) => (
                <g key={s.year}>
                  <path d={linePath(s.counts)} fill="none" stroke={colorOf(s.year, si)} strokeWidth={2.5} opacity={0.9} />
                  {s.counts.map((v, m) => (
                    <g key={m}>
                      <circle cx={x(m)} cy={y(v)} r={v > 0 ? 4 : 2.5} fill={colorOf(s.year, si)} stroke="var(--card-solid)" strokeWidth={1.5} />
                      {v > 0 && (
                        <text x={x(m)} y={y(v) - 7} fontSize={10} fontWeight={700} textAnchor="middle" fill={colorOf(s.year, si)}>{v}</text>
                      )}
                    </g>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, flexWrap: 'wrap' }}>
            {sorted.map((s, si) => (
              <span key={s.year} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: colorOf(s.year, si), display: 'inline-block' }} />
                <b style={{ color: colorOf(s.year, si) }}>{s.year}</b>
                <span>({s.counts.reduce((a, b) => a + b, 0)} เหตุ)</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
