'use client';

import { useEffect, useCallback, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/components/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { HelpCircle } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

/**
 * Onboarding tour for the EA SHE Dashboard landing page.
 * Shows automatically on first visit; can be replayed via the FAB.
 */
export default function OnboardingTour() {
  const auth = useAuth();
  const { hasCompleted, isReady, markCompleted, reset } = useOnboarding();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [fabHover, setFabHover] = useState(false);

  const isAuthed = auth.isAdmin || Object.keys(auth.companyAuth).length > 0;

  const startTour = useCallback(() => {
    const steps: DriveStep[] = [];

    // Step 1 — Logo / top nav
    steps.push({
      element: 'header',
      popover: {
        title: 'ยินดีต้อนรับ! 👋',
        description: 'นี่คือแถบนำทางหลัก คุณสามารถเข้าถึง ค้นหา (⌘K) การแจ้งเตือน และตั้งค่าธีมได้จากที่นี่',
        side: 'bottom',
        align: 'center',
      },
    });

    // Step 2 — Project cards (if visible)
    const projectGrid = document.querySelector('[data-tour="project-grid"]');
    if (projectGrid) {
      steps.push({
        element: '[data-tour="project-grid"]',
        popover: {
          title: 'โครงการของคุณ 📂',
          description: 'คลิกเลือกโครงการที่ต้องการจัดการ แต่ละโครงการมีรายงาน Near Miss, อุบัติเหตุ, แผนฝึกอบรม และอื่นๆ',
          side: 'top',
          align: 'center',
        },
      });
    }

    // Step 3 — Admin KPI button (if admin)
    const adminBtn = document.querySelector('[data-tour="admin-kpi"]');
    if (adminBtn) {
      steps.push({
        element: '[data-tour="admin-kpi"]',
        popover: {
          title: 'Admin Dashboard 📊',
          description: 'ดูภาพรวม KPI ของทุกโครงการในหน้าเดียว รวมถึง Near Miss, อุบัติเหตุ, การฝึกอบรม และชั่วโมงทำงาน',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    // Step 4 — Search button
    const searchBtn = document.querySelector('[data-tour="search-btn"]');
    if (searchBtn) {
      steps.push({
        element: '[data-tour="search-btn"]',
        popover: {
          title: 'ค้นหาได้ทุกอย่าง 🔍',
          description: 'กด ⌘K (หรือ Ctrl+K) เพื่อค้นหาข้ามโครงการ — รายงาน Near Miss, อุบัติเหตุ, พนักงาน, แผนฝึกอบรม',
          side: 'bottom',
          align: 'end',
        },
      });
    }

    // Step 5 — Notification bell
    const bellBtn = document.querySelector('[data-tour="notification-bell"]');
    if (bellBtn) {
      steps.push({
        element: '[data-tour="notification-bell"]',
        popover: {
          title: 'การแจ้งเตือน 🔔',
          description: 'ดูรายการ Near Miss ใหม่, คำขอแก้ไข, อุบัติเหตุล่าสุด ได้ที่นี่',
          side: 'bottom',
          align: 'end',
        },
      });
    }

    if (steps.length === 0) return;

    const d = driver({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'ถัดไป',
      prevBtnText: 'ก่อนหน้า',
      doneBtnText: 'เสร็จสิ้น ✓',
      progressText: '{{current}} / {{total}}',
      steps,
      onDestroyStarted: () => {
        markCompleted();
        d.destroy();
      },
    });

    d.drive();
  }, [markCompleted]);

  // Auto-start on first visit after auth
  useEffect(() => {
    if (!isReady || hasCompleted || !isAuthed) return;
    // Small delay to let the page render fully
    const timer = setTimeout(startTour, 800);
    return () => clearTimeout(timer);
  }, [isReady, hasCompleted, isAuthed, startTour]);

  // Only show FAB when authenticated
  if (!isAuthed) return null;

  return (
    <button
      onClick={() => {
        reset();
        setTimeout(startTour, 100);
      }}
      onMouseEnter={() => setFabHover(true)}
      onMouseLeave={() => setFabHover(false)}
      title="แนะนำการใช้งาน"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 40,
        width: 44,
        height: 44,
        borderRadius: 22,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? fabHover ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'
          : fabHover ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
        color: isDark ? '#a1a1a6' : '#6e6e73',
        boxShadow: isDark
          ? '0 4px 12px rgba(0,0,0,0.4)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        transition: 'all 150ms ease',
      }}
    >
      <HelpCircle size={20} />
    </button>
  );
}
