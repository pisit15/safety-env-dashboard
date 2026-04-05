'use client';

import { useRef, useState, useEffect } from 'react';

/**
 * DateInput — Custom date input that displays DD/MMM/YY format
 * Uses native date picker underneath for browser compatibility
 *
 * Props:
 *  - value: string (YYYY-MM-DD format)
 *  - onChange: (value: string) => void
 *  - style?: React.CSSProperties (applied to wrapper)
 *  - inputStyle?: React.CSSProperties (applied to the visible text input)
 *  - max?: string (YYYY-MM-DD)
 *  - min?: string (YYYY-MM-DD)
 *  - required?: boolean
 *  - placeholder?: string
 *  - disabled?: boolean
 *  - id?: string
 *  - name?: string
 *  - error?: boolean (shows red border)
 *  - locale?: 'th' | 'en'  (default: 'th')
 */

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateDDMMMYY(isoStr: string, locale: 'th' | 'en' = 'th'): string {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-based
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;

  const months = locale === 'th' ? TH_MONTHS : EN_MONTHS;
  const yy = locale === 'th'
    ? String((y + 543) % 100).padStart(2, '0')  // Buddhist year last 2 digits
    : String(y % 100).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${dd}/${months[m]}/${yy}`;
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
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDateDDMMMYY(value, locale));
  }, [value, locale]);

  const openPicker = () => {
    if (disabled) return;
    try {
      hiddenRef.current?.showPicker();
    } catch {
      // fallback: focus which opens picker on most browsers
      hiddenRef.current?.focus();
      hiddenRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
  };

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: '100%',
    ...style,
  };

  const visibleStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 10,
    border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`,
    background: '#f9fafb',
    color: value ? '#111827' : '#9ca3af',
    fontWeight: value ? 500 : 400,
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    boxSizing: 'border-box' as const,
    ...inputStyle,
  };

  const hiddenStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    // Allow the hidden input to receive clicks for the date picker
    zIndex: 1,
  };

  return (
    <div style={baseStyle}>
      {/* Visible formatted display */}
      <input
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        style={visibleStyle}
        tabIndex={-1}
        onClick={openPicker}
      />
      {/* Hidden native date input for picker */}
      <input
        ref={hiddenRef}
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
        style={hiddenStyle}
      />
    </div>
  );
}

/** Utility: format ISO date string to DD/MMM/YY (Thai) — for use in tables/display */
export function fmtDateDDMMMYY(isoStr: string, locale: 'th' | 'en' = 'th'): string {
  if (!isoStr) return '–';
  // Handle ISO datetime strings
  const dateOnly = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr;
  return formatDateDDMMMYY(dateOnly, locale) || '–';
}
