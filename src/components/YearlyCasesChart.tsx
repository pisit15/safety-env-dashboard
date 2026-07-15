'use client';

/**
 * Year-over-year injury case counts — grouped bars: TRC vs LTI.
 * Same color language as the TRIR/LTIFR lines (blue = TRC/TRIR, orange = LTI/LTIFR).
 * Custom SVG (no external chart libraries).
 */

export interface YearlyCasesPoint {
  year: number;
  injuries?: number; // TRC cases
  lti?: number;      // LTI cases
  total?: number;    // all incident cases (shown under the year label)
}

interface Props {
  data: YearlyCasesPoint[];
  title?: string;
}

const C_TRC = '#4E79A7';
const C_LTI = '#F28E2B';

export default function YearlyCasesChart({ data, title = 'จำนวนเคสบาดเจ็บรายปี — TRC / LTI' }: Props) {
  const points = [...data].sort((a, b) => a.year - b.year);

  const W = 760, H = 280;
  const padL = 40, padR = 16, padT = 26, padB = 56;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxV = Math.max(...points.flatMap(p => [p.injuries || 0, p.lti || 0]), 1);
  const step = Math.max(1, Math.ceil(maxV / 4));
  const ticks: number[] = [];
  for (let t = 0; t <= maxV; t += step) ticks.push(t);

  const n = points.length;
  const slotW = plotW / Math.max(n, 1);
  const barW = Math.min(slotW * 0.22, 46);
  const gap = Math.min(barW * 0.25, 10);
  const xCenter = (i: number) => padL + slotW * i + slotW / 2;
  const y = (v: number) => padT + plotH - (v / maxV) * plotH;

  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>TRC = เคสบาดเจ็บทั้งหมด · LTI = เคสหยุดงาน · ตามช่วงปีที่เลือกด้านบน</span>
      </div>

      {points.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>ไม่มีข้อมูลในช่วงปีที่เลือก</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto' }}>
              {/* Gridlines + Y labels */}
              {ticks.map(t => (
                <g key={t}>
                  <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={padL - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--text-secondary)">{t}</text>
                </g>
              ))}

              {/* Grouped bars */}
              {points.map((p, i) => {
                const trc = p.injuries || 0;
                const lti = p.lti || 0;
                const xT = xCenter(i) - gap / 2 - barW;
                const xL = xCenter(i) + gap / 2;
                return (
                  <g key={p.year}>
                    <rect x={xT} y={y(trc)} width={barW} height={Math.max(padT + plotH - y(trc), trc > 0 ? 2 : 0)} rx={4} fill={C_TRC} opacity={0.85} />
                    <text x={xT + barW / 2} y={y(trc) - 5} fontSize={12} fontWeight={700} textAnchor="middle" fill={C_TRC}>{trc}</text>
                    <rect x={xL} y={y(lti)} width={barW} height={Math.max(padT + plotH - y(lti), lti > 0 ? 2 : 0)} rx={4} fill={C_LTI} opacity={0.85} />
                    <text x={xL + barW / 2} y={y(lti) - 5} fontSize={12} fontWeight={700} textAnchor="middle" fill={C_LTI}>{lti}</text>
                  </g>
                );
              })}

              {/* X labels (years + totals) */}
              {points.map((p, i) => (
                <g key={`x-${p.year}`}>
                  <text x={xCenter(i)} y={H - 28} fontSize={12} fontWeight={700} textAnchor="middle" fill="var(--text-primary)">{p.year}</text>
                  {p.total !== undefined && (
                    <text x={xCenter(i)} y={H - 14} fontSize={10} textAnchor="middle" fill="var(--text-secondary)">รวมทุกประเภท {p.total} เหตุ</text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C_TRC, display: 'inline-block' }} /> TRC (เคสบาดเจ็บ)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C_LTI, display: 'inline-block' }} /> LTI (เคสหยุดงาน)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
