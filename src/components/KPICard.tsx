'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  delta?: string;
  deltaColor?: string;
  subtext?: string;
  progress?: number; // 0-100
}

export default function KPICard({ label, value, color = '#fafafa', delta, deltaColor, subtext, progress }: KPICardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      <p className="text-xs text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      {delta && (
        <p className="text-sm mt-1" style={{ color: deltaColor || color }}>{delta}</p>
      )}
      {subtext && (
        <p className="text-xs text-muted mt-1">{subtext}</p>
      )}
      {progress !== undefined && (
        <div className="mt-3 w-full bg-zinc-800 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}
