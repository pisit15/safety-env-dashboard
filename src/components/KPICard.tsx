'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  delta?: string;
  deltaColor?: string;
  subtext?: string;
  progress?: number;
}

export default function KPICard({ label, value, color = '#f5f5f7', delta, deltaColor, subtext, progress }: KPICardProps) {
  return (
    <div className="glass-card p-5 flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-[28px] font-bold tracking-tight leading-none" style={{ color }}>{value}</p>
      {delta && (
        <p className="text-[13px] font-medium mt-1.5" style={{ color: deltaColor || color }}>{delta}</p>
      )}
      {subtext && (
        <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtext}</p>
      )}
      {progress !== undefined && (
        <div className="mt-3 w-full rounded-full h-[5px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-[5px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}
