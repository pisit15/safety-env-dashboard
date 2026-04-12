# EASHE Safety & Environment Dashboard — DESIGN.md

> A plain-text design system document that AI agents read to generate consistent UI.
> Based on [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) standard.

---

## 1. Visual Theme & Atmosphere

**Design Philosophy:** Apple-inspired glass morphism meets industrial safety.
Clean, professional, data-dense dashboard designed for safety officers and executives
to monitor workplace safety & environment compliance across 13+ companies.

**Mood:** Calm authority. The UI feels like a premium macOS/iOS app — frosted glass surfaces,
subtle depth, smooth micro-interactions — but carries the weight of safety-critical data.
Status colors (red, orange, green, blue) communicate urgency at a glance without creating panic.

**Brand Identity:**
- Product name: **EASHE** (Safety & Environment Dashboard)
- Domain: eashe.org
- Language: Thai (primary), English (labels/code)
- Target users: Safety officers, HR managers, company executives

**Theme Modes:** Light (default) and Dark, toggled via `data-theme` attribute on `<html>`.
System preference auto-detection supported.

---

## 2. Color Palette & Roles

### Theme Colors (CSS Variables)

| Token               | Light                    | Dark                     | Role                        |
|----------------------|--------------------------|--------------------------|------------------------------|
| `--bg`              | `#ffffff`               | `#000000`               | Page background              |
| `--bg-secondary`    | `#f5f5f7`               | `#1c1c1e`               | Card/section background      |
| `--bg-tertiary`     | `#e8e8ed`               | `#2c2c2e`               | Nested surfaces              |
| `--card-solid`      | `#ffffff`               | `#1c1c1e`               | Solid card background        |
| `--card-glass`      | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.72)`   | Glass morphism cards         |
| `--accent`          | `#007aff`               | `#0a84ff`               | Primary action / links       |
| `--accent-hover`    | `#0056b3`               | `#409cff`               | Hovered accent               |
| `--accent-glow`     | `rgba(0,122,255,0.15)`  | `rgba(10,132,255,0.25)` | Focus ring glow              |
| `--success`         | `#34c759`               | `#30d158`               | Positive / completed         |
| `--warning`         | `#ff9500`               | `#ff9f0a`               | Attention needed             |
| `--danger`          | `#ff3b30`               | `#ff453a`               | Critical / error             |
| `--info`            | `#5ac8fa`               | `#5ac8fa`               | Informational                |
| `--text-primary`    | `#1d1d1f`               | `#f5f5f7`               | Headings / body text         |
| `--text-secondary`  | `rgba(0,0,0,0.55)`     | `rgba(255,255,255,0.55)` | Secondary labels             |
| `--muted`           | `rgba(0,0,0,0.45)`     | `rgba(255,255,255,0.45)` | Captions / disabled          |
| `--border`          | `rgba(0,0,0,0.08)`     | `rgba(255,255,255,0.1)` | Default borders              |
| `--border-light`    | `rgba(0,0,0,0.12)`     | `rgba(255,255,255,0.15)` | Emphasized borders           |

### Status Colors (she-theme.ts — fixed, not theme-dependent)

| Name         | Hex        | Usage                                      |
|--------------|------------|----------------------------------------------|
| `STATUS.ok`       | `#4E79A7` | Met target / on-track (Steel Blue)         |
| `STATUS.warning`  | `#F28E2B` | Needs attention / pending (Orange)         |
| `STATUS.critical` | `#C23B22` | Severe / overdue (Dark Red)                |
| `STATUS.neutral`  | `#BAB0AC` | No data / not applicable (Gray)            |
| `STATUS.positive` | `#2B8C3E` | Surplus / passed / completed (Dark Green)  |

### Responsibility Colors (she-theme.ts)

| Department              | Hex        |
|-------------------------|------------|
| Safety                  | `#E68000` |
| Environment             | `#2B8C3E` |
| Occupational Health     | `#4E79A7` |
| Admin                   | `#8C8C8C` |
| Other                   | `#BAB0AC` |

---

## 3. Typography Rules

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
             'Inter', 'Helvetica Neue', sans-serif;
```

**Type Scale:**

| Element              | Size         | Weight | Tracking         | Transform  |
|----------------------|-------------|--------|------------------|------------|
| KPI value            | `28px`      | 700    | `tight`          | —          |
| Page heading         | `1.25rem`   | 700    | —                | —          |
| Section heading      | `1rem`      | 600    | —                | —          |
| Body / table cells   | `0.875rem`  | 400    | —                | —          |
| Labels / badges      | `0.7rem`    | 600    | `0.06em`         | uppercase  |
| KPI labels           | `11px`      | 600    | `0.08em`         | uppercase  |
| Captions / small     | `0.625rem`  | 400    | —                | —          |

**Font Weights:** 300 (Light), 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

---

## 4. Component Stylings

### Glass Cards
```css
.glass-card {
  background: var(--card-glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 20px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}
```

### KPI Cards
- Container: `glass-card p-5 flex flex-col relative overflow-hidden`
- Label: `text-[11px] uppercase tracking-[0.08em] font-semibold color: var(--muted)`
- Value: `text-[28px] font-bold tracking-tight leading-none`
- Optional progress bar: `h-[5px] rounded-full` with animated width fill

### Buttons
```css
/* Primary */
.btn-primary {
  background: var(--accent);
  color: #ffffff;
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
}
```

### Badges
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;        /* full pill */
  font-size: 0.7rem;            /* 11px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
/* Variants use semi-transparent backgrounds: rgba(color, 0.12) */
.badge-done     { background: rgba(52,199,89,0.12);  color: #2B8C3E; }
.badge-progress { background: rgba(255,149,0,0.12);  color: #E68000; }
.badge-danger   { background: rgba(255,59,48,0.12);  color: #C23B22; }
```

### Tables
```css
.apple-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.apple-table th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.apple-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.apple-table tr:hover {
  background: var(--bg-secondary);
  transition: background 150ms;
}
```

### Input Fields
```css
input, select, textarea {
  background: var(--card-solid);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: border-color 200ms;
}
input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
```

### Sidebar Navigation
- Dark glass background with nested menu groups
- Lucide React icons for each menu item
- Active state: accent-colored background highlight
- Responsive: collapsible on mobile
- Theme toggle button integrated at bottom

### Drawers / Modals
- Overlay: `bg-black/40 backdrop-blur-sm`
- Panel: `max-w-[380px] glass-card` sliding from right
- Close button: top-right corner with `X` icon
- Content: scrollable with `overflow-y-auto`

---

## 5. Layout Principles

### Spacing Scale (Tailwind-based)
```
4px   → gap-1, p-1, m-1
8px   → gap-2, p-2, m-2
12px  → gap-3, p-3, m-3
16px  → gap-4, p-4, m-4
20px  → gap-5, p-5, m-5
24px  → gap-6, p-6, m-6
32px  → gap-8, p-8, m-8
```

### Grid System
- Flexbox-based: `flex`, `flex-col`, `flex-wrap` with `gap-` utilities
- KPI row: `flex flex-wrap gap-3` — cards use `flex-1 min-w-[200px]`
- Page layout: Sidebar (fixed 280px) + Main content (fluid)
- Tables: full-width with horizontal scroll on overflow

### Responsive Breakpoints
| Breakpoint | Width    | Behavior                        |
|------------|----------|----------------------------------|
| `sm:`      | ≥640px  | Stack → 2 columns               |
| `md:`      | ≥768px  | Sidebar visible                  |
| `lg:`      | ≥1024px | Full layout, 3-4 KPI columns     |
| `xl:`      | ≥1280px | Expanded tables                  |
| `2xl:`     | ≥1536px | Maximum content width            |

### Border Radius Scale
| Size    | Value  | Usage                     |
|---------|--------|----------------------------|
| Default | `12px` | Buttons, inputs            |
| Cards   | `20px` | Glass cards                |
| Apple   | `16px` | `.rounded-apple`          |
| Large   | `20px` | `.rounded-apple-lg`       |
| XL      | `24px` | `.rounded-apple-xl`       |
| Full    | `9999px` | Badges, avatars          |

---

## 6. Depth & Elevation

### Shadow System (CSS Variables)

| Level       | Light                                | Dark                                 | Usage                  |
|-------------|--------------------------------------|--------------------------------------|------------------------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)`       | `0 1px 3px rgba(0,0,0,0.3)`        | Subtle lift            |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)`      | `0 4px 12px rgba(0,0,0,0.4)`       | Cards, dropdowns       |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.12)`      | `0 8px 30px rgba(0,0,0,0.5)`       | Hover cards, modals    |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,0.15)`     | `0 20px 60px rgba(0,0,0,0.6)`      | Overlays, drawers      |

### Glass Morphism Layers
```
Layer 0 — Page background:     var(--bg), no blur
Layer 1 — Subtle glass:        backdrop-filter: blur(20px) saturate(150%)
Layer 2 — Card glass:          backdrop-filter: blur(20px) saturate(180%)
Layer 3 — Heavy glass:         backdrop-filter: blur(40px) saturate(200%)
Layer 4 — Overlay:             bg-black/40 backdrop-blur-sm
```

### Glow Effects
```css
.glow-accent  { box-shadow: 0 0 20px rgba(10, 132, 255, 0.15); }
.glow-success { box-shadow: 0 0 20px rgba(52, 199, 89, 0.15); }
```

---

## 7. Do's and Don'ts

### Do's
- **DO** use CSS variables for all colors — never hardcode hex in components (except STATUS constants)
- **DO** use glass morphism (`.glass-card`) for elevated content surfaces
- **DO** keep Thai language for all user-facing labels; English for code/technical terms
- **DO** use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions (Apple-style easing)
- **DO** show status with color-coded badges: green=done, orange=in-progress, red=critical
- **DO** use Lucide React for all icons (consistent stroke-width, `currentColor`)
- **DO** support both light and dark themes in every new component
- **DO** use `0.875rem` (14px) as the default body text size
- **DO** use uppercase + letter-spacing for labels and table headers
- **DO** use Supabase for persistent data, Google Sheets as read-only data source

### Don'ts
- **DON'T** use Material Design, Bootstrap, or other design system components
- **DON'T** mix icon libraries — Lucide React only
- **DON'T** use sharp corners — minimum border-radius is 12px for interactive elements
- **DON'T** use heavy drop shadows in dark mode — reduce opacity instead
- **DON'T** hardcode Thai strings in components — but constants/enums are acceptable
- **DON'T** use localStorage for authentication — use sessionStorage
- **DON'T** call Supabase directly from client components — always go through API routes
- **DON'T** use `getServiceSupabase()` in client-side code (service role key = server only)
- **DON'T** skip the glass blur effect on cards — it's core to the visual identity

---

## 8. Responsive Behavior

### Mobile (< 768px)
- Sidebar collapses to hamburger menu
- KPI cards stack vertically (1 column)
- Tables switch to horizontal scroll
- Drawers slide up as bottom sheets (full-width)
- Font sizes remain the same (no scaling down)

### Tablet (768px – 1024px)
- Sidebar toggleable with overlay
- KPI cards: 2 per row
- Tables visible with scroll
- Drawers: 380px from right

### Desktop (≥ 1024px)
- Sidebar always visible (280px fixed)
- KPI cards: 3-4 per row with `flex-wrap`
- Tables: full-width with all columns
- Drawers: 380px from right with backdrop

### Interaction Patterns
- **Hover lift:** Cards and buttons lift `translateY(-1px)` on hover
- **Focus rings:** `box-shadow: 0 0 0 3px var(--accent-glow)` on focus
- **Loading states:** Shimmer animation on skeleton placeholders
- **Transitions:** 150-200ms for hover, 300ms for theme switch, 700ms for progress bars

---

## 9. Agent Prompt Guide

### Quick Reference for AI Agents

**When building new pages/components:**
```
- Framework: Next.js 14 App Router (src/app/ directory)
- Styling: Tailwind CSS + globals.css custom classes
- Icons: import { IconName } from 'lucide-react'
- Database: Supabase via API routes (never direct client calls)
- Auth: useAuth() hook from '@/components/AuthContext'
- Theme: useTheme() hook from '@/components/ThemeProvider'
- Colors: import { STATUS, RESPONSIBILITY } from '@/lib/she-theme'
```

**Card component pattern:**
```tsx
<div className="glass-card p-5">
  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold"
     style={{ color: 'var(--muted)' }}>
    LABEL
  </p>
  <p className="text-[28px] font-bold tracking-tight mt-1"
     style={{ color: 'var(--text-primary)' }}>
    {value}
  </p>
</div>
```

**Status badge pattern:**
```tsx
<span className="badge badge-done">เสร็จแล้ว</span>
<span className="badge badge-progress">กำลังดำเนินการ</span>
<span className="badge badge-danger">เกินกำหนด</span>
```

**API route pattern:**
```typescript
// src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  // ... query logic
  return NextResponse.json({ data });
}
```

**Key file locations:**
```
/src/app/globals.css          → All CSS variables and component classes
/src/lib/she-theme.ts         → STATUS and RESPONSIBILITY color constants
/src/lib/supabase.ts          → Supabase client (getSupabase / getServiceSupabase)
/src/lib/types.ts             → TypeScript interfaces
/src/components/Sidebar.tsx   → Navigation structure
/src/components/KPICard.tsx   → KPI card component
/tailwind.config.ts           → Tailwind theme extensions
```

---

## Architecture Overview

### Tech Stack
| Layer      | Technology                          |
|------------|--------------------------------------|
| Framework  | Next.js 14 (App Router)             |
| Language   | TypeScript 5.4                       |
| Styling    | Tailwind CSS 3.4 + custom CSS       |
| Database   | Supabase (PostgreSQL)               |
| Data Source | Google Sheets API (read-only)       |
| Icons      | Lucide React                         |
| Charts     | Chart.js 4.4 (via CDN)             |
| Export     | ExcelJS (.xlsx), jsPDF + html2canvas |
| Hosting    | Vercel                               |

### Database Tables (Supabase)
| Table                  | Purpose                              |
|------------------------|--------------------------------------|
| `company_auth`         | Company user credentials             |
| `status_overrides`     | Activity status changes              |
| `activity_metadata`    | Rich activity data (priority, dates) |
| `audit_log`            | Complete change history               |
| `activity_attachments` | File metadata (Google Drive links)   |
| `edit_requests`        | Post-deadline edit approvals         |
| `cancellation_requests` | Status change approvals             |
| `near_miss_reports`    | Near miss incident reports           |
| `company_settings`     | Per-company config overrides         |

### Authentication
- **Admin:** sessionStorage `admin_auth` → verified via `/api/admin-auth`
- **Company:** sessionStorage `auth_{companyId}` → verified via `/api/auth`
- **Context:** `AuthProvider` wraps app, `useAuth()` hook for components

### Data Flow
```
Google Sheets (primary data) ──► /api/dashboard ──► Client renders KPIs
                                      │
Supabase (overrides/metadata) ────────┘
```

---

*Generated for EASHE Safety & Environment Dashboard (eashe.org)*
*Format: [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) standard*
