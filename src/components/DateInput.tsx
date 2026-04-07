'use client';

import { useRef } from 'react';

/**
 * DateInput — Custom date input that displays DD/MMM/YY format
 * Strategy: Use a real native date input (visible, clickable, with picker icon)
 * but make its text transparent, then overlay a formatted label on top.
 */

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateDDMMMYY(isoStr: string, locale: 'th' | 'en' = 'th'): string {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;

  const months = locale === 'th' ? TH_MONTHS : EN_MONTHS;
  const yearStr = locale === 'th'
    ? String(y + 543)
    : String(y);
  const dd = String(d).padStart(2, '0');
  return `${dd}/${months[m]}/${yearStr}`;
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  max?: string;
  min?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  error?: boolean;
  locale?: 'th' | 'en';
  autoFocus?: boolean;
}

export default function DateInput({
  value,
  onChange,
  style,
  inputStyle,
  max,
  min,
  required,
  placeholder = 'DD/MMM/YY',
  disabled,
  id,
  name,
  error,
  locale = 'th',
  autoFocus,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayText = value ? formatDateDDMMMYY(value, locale) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Extract padding from inputStyle for the overlay to match
  const padding = (inputStyle as Record<string, unknown>)?.padding ?? '10px 12px';
  const fontSize = (inputStyle as Record<string, unknown>)?.fontSize ?? 14;
  const borderRadius = (inputStyle as Record<string, unknown>)?.borderRadius ?? 10;
  const borderColor = error ? '#ef4444' : ((inputStyle as Record<string, unknown>)?.borderColor ?? '#e5e7eb');
  const bg = (inputStyle as Record<string, unknown>)?.background ?? (inputStyle as Record<string, unknown>)?.backgroundColor ?? '#f9fafb';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        ...style,
      }}
    >
      {/* Real native date input — text is transparent so we can show our own format */}
      <input
        ref={inputRef}
        type="date"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        max={max}
        min={min}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: padding as string,
          fontSize: fontSize as number,
          borderRadius: borderRadius as number,
          border: `1.5px solid ${borderColor as string}`,
          background: bg as string,
          color: 'transparent',       // hide native text
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          // Keep the calendar icon visible
          colorScheme: 'light',
          ...inputStyle,
          // Force transparent text (override inputStyle color)
          // @ts-expect-error: color override
          color: 'transparent',
        }}
      />
      {/* Overlay label showing DD/MMM/YY — does not block clicks (pointerEvents: none) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          padding: padding as string,
          fontSize: fontSize as number,
          fontWeight: value ? 500 : 400,
          color: value ? '#111827' : '#9ca3af',
          pointerEvents: 'none',     // clicks pass through to the real input
          fontFamily: 'inherit',
          userSelect: 'none',
        }}
      >
        {displayText || placeholder}
      </div>
    </div>
  );
}

/** Utility: format ISO date string to DD/MMM/YY (Thai) — for use in tables/display */
export function fmtDateDDMMMYY(isoStr: string, locale: 'th' | 'en' = 'th'): string {
  if (!isoStr) return '–';
  const dateOnly = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr;
  return formatDateDDMMMYY(dateOnly, locale) || '–';
}
