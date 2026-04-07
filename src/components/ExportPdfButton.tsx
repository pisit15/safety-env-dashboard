'use client';

import { useState, useCallback, useRef } from 'react';
import { FileDown, Loader2, Check } from 'lucide-react';

/**
 * ExportPdfButton — ปุ่ม Export PDF ที่ใช้ html2canvas + jsPDF
 *
 * วิธีใช้:
 *   1. ครอบ content ที่ต้องการ export ด้วย <div id="pdf-content">
 *   2. วาง <ExportPdfButton /> ที่ต้องการ
 *
 * Props:
 *   - targetId: id ของ element ที่จะ capture (default: 'pdf-content')
 *   - filename: ชื่อไฟล์ PDF (ไม่ต้องมี .pdf)
 *   - title: หัวเรื่องที่จะแสดงบน PDF header
 *   - subtitle: รายละเอียดย่อย (เช่น ชื่อบริษัท, ปี)
 *   - orientation: 'portrait' | 'landscape' (default: 'landscape')
 *   - compact: ปุ่มขนาดเล็ก (icon only)
 */

interface ExportPdfButtonProps {
  targetId?: string;
  filename?: string;
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  compact?: boolean;
  label?: string;
}

export default function ExportPdfButton({
  targetId = 'pdf-content',
  filename = 'report',
  title,
  subtitle,
  orientation = 'landscape',
  compact = false,
  label = 'Export PDF',
}: ExportPdfButtonProps) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExport = useCallback(async () => {
    if (status === 'exporting') return;
    setStatus('exporting');

    try {
      // Dynamic imports to keep bundle small
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const el = document.getElementById(targetId);
      if (!el) {
        console.error(`ExportPDF: element #${targetId} not found`);
        setStatus('idle');
        return;
      }

      // Temporarily remove max-height / overflow to capture full content
      const originalStyles: Record<string, string> = {};
      const scrollEls = el.querySelectorAll<HTMLElement>('[style*="max-height"], [style*="overflow"]');
      scrollEls.forEach((child, i) => {
        const key = `__pdf_restore_${i}`;
        originalStyles[key] = child.style.cssText;
        child.dataset.pdfRestore = key;
        child.style.maxHeight = 'none';
        child.style.overflow = 'visible';
      });
      // Also handle the target itself
      const origTargetOverflow = el.style.overflow;
      const origTargetMaxH = el.style.maxHeight;
      el.style.overflow = 'visible';
      el.style.maxHeight = 'none';

      // Capture
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // Restore original styles
      scrollEls.forEach((child) => {
        const key = child.dataset.pdfRestore;
        if (key && originalStyles[key] !== undefined) {
          child.style.cssText = originalStyles[key];
        }
        delete child.dataset.pdfRestore;
      });
      el.style.overflow = origTargetOverflow;
      el.style.maxHeight = origTargetMaxH;

      // Create PDF
      const isLandscape = orientation === 'landscape';
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Header area
      const headerH = title ? 18 : 4;
      const marginX = 8;
      const marginTop = 6;
      const contentW = pageW - marginX * 2;
      const footerH = 10;
      const contentH = pageH - headerH - marginTop - footerH;

      // Draw header on first page
      const drawHeader = (pageNum: number, totalPages: number) => {
        if (title) {
          // Background bar
          pdf.setFillColor(30, 30, 46);
          pdf.rect(0, 0, pageW, headerH, 'F');

          // Title
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(12);
          pdf.text(title, marginX, 8);

          // Subtitle
          if (subtitle) {
            pdf.setFontSize(8);
            pdf.setTextColor(180, 180, 200);
            pdf.text(subtitle, marginX, 13);
          }

          // Page number
          pdf.setFontSize(7);
          pdf.setTextColor(150, 150, 170);
          pdf.text(`${pageNum} / ${totalPages}`, pageW - marginX, 8, { align: 'right' });
        }
      };

      // Footer
      const drawFooter = () => {
        const y = pageH - 5;
        pdf.setFontSize(7);
        pdf.setTextColor(160, 160, 160);
        const now = new Date();
        const dateStr = now.toLocaleDateString('th-TH', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        pdf.text(`Safety & Environment Dashboard — ${dateStr}`, marginX, y);
        pdf.text('eashe.org', pageW - marginX, y, { align: 'right' });
      };

      // Calculate how the image fits
      const imgW = canvas.width;
      const imgH = canvas.height;
      const scale = contentW / imgW;
      const scaledH = imgH * scale;

      // How many pages?
      const totalPages = Math.ceil(scaledH / contentH);

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage();

        drawHeader(p + 1, totalPages);

        // Clip the canvas portion for this page
        const srcY = (p * contentH) / scale;
        const srcH = Math.min(contentH / scale, imgH - srcY);

        // Create a temporary canvas for this slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgW;
        sliceCanvas.height = Math.ceil(srcH);
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            canvas,
            0, Math.floor(srcY * 2), imgW * 2, Math.ceil(srcH * 2),
            0, 0, imgW, Math.ceil(srcH),
          );
        }

        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHmm = srcH * scale;

        pdf.addImage(
          sliceData, 'PNG',
          marginX, headerH + marginTop,
          contentW, sliceHmm,
          undefined, 'FAST',
        );

        drawFooter();
      }

      // Save
      const safeFilename = filename.replace(/[^a-zA-Z0-9ก-๙_\-\s]/g, '').trim() || 'report';
      pdf.save(`${safeFilename}.pdf`);

      setStatus('done');
      timeoutRef.current = setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('PDF export failed:', err);
      setStatus('idle');
    }
  }, [status, targetId, filename, title, subtitle, orientation]);

  const isExporting = status === 'exporting';
  const isDone = status === 'done';

  if (compact) {
    return (
      <button
        onClick={handleExport}
        disabled={isExporting}
        title={label}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: 'none',
          cursor: isExporting ? 'wait' : 'pointer',
          background: isDone ? 'rgba(52,199,89,0.1)' : 'var(--bg-secondary)',
          color: isDone ? '#34c759' : 'var(--text-secondary)',
          transition: 'all 0.2s ease',
        }}
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : isDone ? <Check size={16} /> : <FileDown size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 10, border: 'none',
        cursor: isExporting ? 'wait' : 'pointer',
        fontSize: 13, fontWeight: 600,
        background: isDone
          ? 'linear-gradient(135deg, #34c759, #22c55e)'
          : 'linear-gradient(135deg, #ff3b30, #f97316)',
        color: '#fff',
        boxShadow: isDone
          ? '0 2px 10px rgba(52,199,89,0.3)'
          : '0 2px 10px rgba(255,59,48,0.25)',
        transition: 'all 0.25s ease',
        opacity: isExporting ? 0.7 : 1,
      }}
    >
      {isExporting ? (
        <><Loader2 size={15} className="animate-spin" /> กำลังสร้าง PDF...</>
      ) : isDone ? (
        <><Check size={15} /> ดาวน์โหลดแล้ว!</>
      ) : (
        <><FileDown size={15} /> {label}</>
      )}
    </button>
  );
}
