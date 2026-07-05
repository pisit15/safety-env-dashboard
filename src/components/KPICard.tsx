'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  delta?: string;
  deltaColor?: string;
  subtext?: string;
  progress?: number;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}

export default function KPICard({ label, value, color, delta, deltaColor, subtext, progress, onClick, active, title }: KPICardProps) {
  const valueColor = color || 'var(--text-primary)';

  return (
    <div
      onClick={onClick}
      title={title}
      className={`glass-card p-5 flex flex-col relative overflow-hidden group flex-1 w-full ${onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''}`}
      style={active ? { outline: '2px solid var(--accent)', outlineOffset: '-1px' } : undefined}
    >
      {/* Subtle accent glow */}
      {color && (
        <div
          className="absolute -top-8 -left-8 w-24 h-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
          style={{ background: color }}
        />
      )}

      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3 relative" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-[28px] font-bold tracking-tight leading-none relative" style={{ color: valueColor }}>{value}</p>
      {delta && (
        <p className="text-[13px] font-medium mt-1.5 relative" style={{ color: deltaColor || valueColor }}>{delta}</p>
      )}
      {subtext && (
        <p className="text-[11px] mt-1 relative" style={{ color: 'var(--muted)' }}>{subtext}</p>
      )}
      {progress !== undefined && (
        <div className="mt-3 w-full rounded-full h-[5px] relative" style={{ background: 'var(--bg-tertiary)' }}>
          <div
            className="h-[5px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: color || 'var(--accent)',
              boxShadow: color ? `0 0 10px ${color}50` : undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}
