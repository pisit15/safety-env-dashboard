'use client';

export default function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    done:        { bg: 'bg-green-900/50',  text: 'text-green-400',  label: '✅ เสร็จแล้ว' },
    not_started: { bg: 'bg-orange-900/40', text: 'text-orange-400', label: '⏳ ยังไม่เริ่ม' },
    postponed:   { bg: 'bg-blue-900/40',   text: 'text-blue-400',   label: '📅 เลื่อน' },
    cancelled:   { bg: 'bg-red-900/40',    text: 'text-red-400',    label: '❌ ยกเลิก' },
  };
  const c = config[status] || config.not_started;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
