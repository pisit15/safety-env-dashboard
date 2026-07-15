'use client';

/**
 * Year-over-year comparison chart — Manhours bars + TRIR/LTIFR lines.
 * Custom SVG (no external chart libraries). Left axis = manhours, right axis = rate.
 */

export interface YearlyTrendPoint {
  year: number;
  mh: number;     // total manhours
  trir: number;
  ltifr: number;
  total?: number;    // incident cases (all types)
  injuries?: number; // recordable injuries (TRC) — TRIR numerator
  lti?: number;      // lost-time cases — LTIFR numerator
}

interface Props {
  data: YearlyTrendPoint[];
  trirTarget?: number;   // e.g. 3.0
  ltifrTarget?: number;  // e.g. 1.0
}

import { TRIR_TARGET, LTIFR_TARGET } from '@/lib/she-targets';

const C_MH = '#BAB0AC';
const C_TRIR = '#4E79A7';
const C_LTIFR = '#F28E2B';

const fmtMh = (v: number) =>
  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` :
  v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v));

export default function YearlyTrendChart({ data, trirTarget = TRIR_TARGET, ltifrTarget = LTIFR_TARGET }: Props) {
  const points = [...data].sort((a, b) => a.year - b.year);

  const W = 760, H = 296;
  const padL = 52, padR = 52, padT = 24, padB = 56;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxMh = Math.max(...points.map(p => p.mh), 1);
  const maxRate = Math.max(...points.map(p => Math.max(p.trir, p.ltifr)), trirTarget, 1) * 1.15;

  const n = points.length;
  const slotW = plotW / Math.max(n, 1);
  const barW = Math.min(slotW * 0.42, 64);
  const xCenter = (i: number) => padL + slotW * i + slotW / 2;
  const yMh = (v: number) => padT + plotH - (v / maxMh) * plotH;
  const yRate = (v: number) => padT + plotH - (v / maxRate) * plotH;

  const linePath = (key: 'trir' | 'ltifr') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i)} ${yRate(p[key])}`).join(' ');

  return (
    <div style={{ background: 'var(--card-solid)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เปรียบเทียบรายปี — TRIR / LTIFR / Manhours</h3>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ตามช่วงปีที่เลือกด้านบน · อัตราต่อ 1,000,000 ชม.</span>
      </div>

      {points.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-secondary)' }}>ไม่มีข้อมูลในช่วงปีที่เลือก</div>
      ) : (
        <>
          {points.length === 1 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              เลือกหลายปี (เช่น &ldquo;3 ปีล่าสุด&rdquo; หรือ &ldquo;ทั้งหมด&rdquo;) เพื่อดูแนวโน้มเปรียบเทียบ
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto' }}>
              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <line key={f} x1={padL} x2={W - padR} y1={padT + plotH * f} y2={padT + plotH * f} stroke="var(--border)" strokeWidth={1} />
              ))}

              {/* TRIR target line */}
              <line x1={padL} x2={W - padR} y1={yRate(trirTarget)} y2={yRate(trirTarget)} stroke={C_TRIR} strokeWidth={1} strokeDasharray="5 4" opacity={0.55} />
              <text x={W - padR + 4} y={yRate(trirTarget) + 3} fontSize={9} fill={C_TRIR} opacity={0.8}>อ้างอิง {trirTarget}</text>
              {/* LTIFR target line */}
              <line x1={padL} x2={W - padR} y1={yRate(ltifrTarget)} y2={yRate(ltifrTarget)} stroke={C_LTIFR} strokeWidth={1} strokeDasharray="5 4" opacity={0.55} />
              <text x={W - padR + 4} y={yRate(ltifrTarget) + 3} fontSize={9} fill={C_LTIFR} opacity={0.8}>เป้า 2030 · {ltifrTarget}</text>

              {/* Manhours bars */}
              {points.map((p, i) => (
                <g key={p.year}>
                  <rect x={xCenter(i) - barW / 2} y={yMh(p.mh)} width={barW} height={Math.max(padT + plotH - yMh(p.mh), 1)} rx={4} fill={C_MH} opacity={0.5} />
                  <text x={xCenter(i)} y={yMh(p.mh) - 4} fontSize={10} textAnchor="middle" fill="var(--text-secondary)">{fmtMh(p.mh)}</text>
                </g>
              ))}

              {/* Rate lines */}
              {points.length > 1 && <path d={linePath('trir')} fill="none" stroke={C_TRIR} strokeWidth={2.5} />}
              {points.length > 1 && <path d={linePath('ltifr')} fill="none" stroke={C_LTIFR} strokeWidth={2.5} />}

              {/* Rate dots + labels */}
              {points.map((p, i) => (
                <g key={`r-${p.year}`}>
                  <circle cx={xCenter(i)} cy={yRate(p.trir)} r={4.5} fill={C_TRIR} stroke="var(--card-solid)" strokeWidth={1.5} />
                  <text x={xCenter(i)} y={yRate(p.trir) - 8} fontSize={11} fontWeight={700} textAnchor="middle" fill={C_TRIR}>{p.trir.toFixed(2)}</text>
                  <circle cx={xCenter(i)} cy={yRate(p.ltifr)} r={4.5} fill={C_LTIFR} stroke="var(--card-solid)" strokeWidth={1.5} />
                  <text x={xCenter(i)} y={yRate(p.ltifr) + 18} fontSize={11} fontWeight={700} textAnchor="middle" fill={C_LTIFR}>{p.ltifr.toFixed(2)}</text>
                </g>
              ))}

              {/* X labels (years) + case counts */}
              {points.map((p, i) => (
                <g key={`x-${p.year}`}>
                  <text x={xCenter(i)} y={H - 28} fontSize={12} fontWeight={700} textAnchor="middle" fill="var(--text-primary)">{p.year}</text>
                  {p.total !== undefined && (
                    <text x={xCenter(i)} y={H - 14} fontSize={10} textAnchor="middle" fill="var(--text-secondary)">
                      {p.total} เหตุ · TRC <tspan fill={C_TRIR} fontWeight={700}>{p.injuries ?? 0}</tspan> · LTI <tspan fill={C_LTIFR} fontWeight={700}>{p.lti ?? 0}</tspan>
                    </text>
                  )}
                </g>
              ))}

              {/* Axis captions */}
              <text x={padL} y={12} fontSize={9} fill="var(--text-secondary)">Manhours</text>
              <text x={W - padR} y={12} fontSize={9} textAnchor="end" fill="var(--text-secondary)">อัตรา (ต่อ 1M ชม.)</text>
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C_MH, opacity: 0.5, display: 'inline-block' }} /> Manhours
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: C_TRIR, display: 'inline-block' }} /> TRIR
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: C_LTIFR, display: 'inline-block' }} /> LTIFR
            </span>
            <span style={{ opacity: 0.75 }}>เส้นประ = เป้าหมาย</span>
          </div>
        </>
      )}
    </div>
  );
}
