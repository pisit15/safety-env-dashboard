'use client';

// Apple-style theme toggle — cycles through light / dark / system
// Uses existing ThemeProvider under the hood.
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  variant?: 'light' | 'dark' | 'auto'; // text/icon color tuning for context
  size?: 'sm' | 'md';
}

export default function ThemeToggle({ variant = 'auto', size = 'md' }: Props) {
  const { theme, setTheme } = useTheme();
  const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
  const currentIdx = order.indexOf(theme);
  const next = order[(currentIdx + 1) % order.length];

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  const colors = variant === 'light'
    ? { fg: '#fff', hoverBg: 'rgba(255,255,255,0.1)' }
    : variant === 'dark'
    ? { fg: '#1d1d1f', hoverBg: 'rgba(0,0,0,0.06)' }
    : { fg: 'var(--text-primary)', hoverBg: 'rgba(127,127,127,0.12)' };

  const px = size === 'sm' ? 8 : 10;
  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Theme: ${label} — click to switch to ${next}`}
      aria-label={`Switch theme (currently ${label})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: `${px - 2}px ${px + 2}px`,
        background: 'transparent',
        border: 'none',
        color: colors.fg,
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500,
        transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = colors.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={iconSize} />
      {size === 'md' && <span>{label}</span>}
    </button>
  );
}
