# Apple-Style Light/Dark Theme System

## Overview
The dashboard now has a complete Apple-inspired theme system with support for light, dark, and system preference modes.

## Files Created/Modified

### 1. `/src/app/globals.css` (459 lines)
Complete CSS variable system with:
- Light theme variables (default `:root`)
- Dark theme variables (`[data-theme="dark"]`)
- All component styles updated to use CSS variables
- Smooth transitions between themes
- Apple-style glass morphism, shadows, and animations

### 2. `/src/components/ThemeProvider.tsx` (NEW)
React context-based theme provider with:
- `useTheme()` hook for components
- Support for 'light', 'dark', and 'system' modes
- Automatic system preference detection
- Persistent storage in localStorage
- No hydration mismatch issues

### 3. `/src/app/layout.tsx` (UPDATED)
- Added `ThemeProvider` wrapper
- Added inline script to prevent flash of wrong theme
- Added `suppressHydrationWarning` to html tag

## Usage

### Using the Theme Hook in Components
```tsx
'use client';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
      <p>Current: {resolvedTheme}</p>
    </div>
  );
}
```

### CSS Variables Available
All components automatically use the correct theme colors:

**Colors:**
- `--bg` - Main background
- `--bg-secondary` - Secondary background
- `--bg-tertiary` - Tertiary background
- `--accent` - Primary accent color
- `--success`, `--warning`, `--danger`, `--info` - Status colors
- `--text-primary`, `--text-secondary` - Text colors
- `--border`, `--border-light` - Border colors

**Shadows:**
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`

**Example:**
```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}
```

## Color Palettes

### Light Theme
- Background: #ffffff
- Secondary: #f5f5f7
- Accent: #007aff (iOS Blue)
- Text Primary: #1d1d1f
- Text Secondary: rgba(0, 0, 0, 0.55)

### Dark Theme
- Background: #000000
- Secondary: #1c1c1e
- Accent: #0a84ff (Lighter iOS Blue for dark)
- Text Primary: #f5f5f7
- Text Secondary: rgba(255, 255, 255, 0.55)

## Key CSS Classes

### Glass Cards
```html
<div class="glass-card">Content</div>
```

### Buttons
```html
<button class="btn-primary">Primary</button>
<button class="btn-secondary">Secondary</button>
```

### Badges
```html
<span class="badge badge-done">Done</span>
<span class="badge badge-progress">Progress</span>
<span class="badge badge-pending">Pending</span>
```

### Tables
```html
<table class="apple-table">
  <thead>
    <tr><th>Column</th></tr>
  </thead>
  <tbody>
    <tr><td>Data</td></tr>
  </tbody>
</table>
```

## Animations
All animations work across both themes:
- `.animate-fade-in-up`
- `.animate-fade-in`
- `.animate-scale-in`
- `.stagger-1` through `.stagger-7`

## Features

✅ **No Flash of Wrong Theme** - Inline script ensures correct theme loads immediately  
✅ **System Preference Detection** - Respects OS dark mode settings  
✅ **Smooth Transitions** - All theme changes animate smoothly (0.3s)  
✅ **LocalStorage Persistence** - User theme preference saved  
✅ **No Hydration Issues** - Proper client-side mounting  
✅ **Apple Design System** - Authentic iOS/macOS aesthetics  
✅ **All Components Updated** - Existing classes use CSS variables  
✅ **Backward Compatible** - All previous animations and styles work

## Notes

- Light theme is the default
- Theme preference is stored in `localStorage.theme`
- The system respects user's OS preference when set to 'system'
- All transitions use cubic-bezier(0.4, 0, 0.2, 1) for smooth Apple-style motion
