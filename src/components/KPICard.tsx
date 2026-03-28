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
    <div
      className="glass-card p-5 flex flex-col relative overflow-hidden group"
    >
      {/* Subtle top-left accent glow */}
      <div
        className="absolute -top-10 -left-10 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
        style={{ background: color }}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3 relative" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <p className="text-[30px] font-bold tracking-tight leading-none relative" style={{ color }}>{value}</p>
      {delta && (
        <p className="text-[13px] font-medium mt-1.5 relative" style={{ color: deltaColor || color }}>{delta}</p>
      )}
      {subtext && (
        <p className="text-[11px] mt-1 relative" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtext}</p>
      )}
      {progress !== undefined && (
        <div className="mt-3 w-full rounded-full h-[5px] relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-[5px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: color,
              boxShadow: `0 0 12px ${color}60`,
            }}
          />
        </div>
      )}
    </div>
  );
}
