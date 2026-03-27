'use client';

export default function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    done: { bg: 'bg-green-900/50', text: 'text-green-400', label: '✅ เสร็จ' },
    in_progress: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: '🔄 กำลังทำ' },
    not_started: { bg: 'bg-orange-900/40', text: 'text-orange-400', label: '⏳ ยังไม่เริ่ม' },
  };
  const c = config[status] || config.not_started;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
