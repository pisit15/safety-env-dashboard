'use client';

import { useEffect, useRef } from 'react';
import { CompanySummary, MonthlyProgress } from '@/lib/types';

declare const Chart: any;

// Helper function to get current theme
function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Helper function to get theme-aware colors
function getThemeColors(isDark: boolean) {
  return {
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tick: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
    label: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
    legend: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
  };
}

// Status/accent colors that work in both themes
const statusColors = {
  green: '#34c759',
  orange: '#ff9500',
  blue: '#007aff',
  red: '#ff3b30',
  gray: '#8e8e93',
  infoBright: '#5ac8fa',
};

interface RankingChartProps {
  companies: CompanySummary[];
}

export function RankingChart({ companies }: RankingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    const isDark = getTheme();
    const colors = getThemeColors(isDark);

    const sorted = [...companies].sort((a, b) => a.pctDone - b.pctDone);
    const labels = sorted.map(c => c.shortName);
    const data = sorted.map(c => c.pctDone);

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map((p: number) => p >= 25 ? statusColors.green : statusColors.orange),
          borderRadius: 6,
          barThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.raw}% สำเร็จ`,
            },
          },
        },
        scales: {
          x: {
            max: 50,
            grid: { color: colors.grid },
            ticks: { color: colors.tick, callback: (v: number) => v + '%' },
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.label, font: { size: 11 } },
          },
        },
      },
      plugins: [{
        id: 'targetLine',
        afterDraw(chart: any) {
          const xScale = chart.scales.x;
          const x = xScale.getPixelForValue(25);
          const ctx = chart.ctx;
          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = statusColors.red;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, chart.chartArea.top);
          ctx.lineTo(x, chart.chartArea.bottom);
          ctx.stroke();
          ctx.fillStyle = statusColors.red;
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText('Target Q1: 25%', x + 5, chart.chartArea.top + 10);
          ctx.restore();
        },
      }],
    });

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      if (chartRef.current) chartRef.current.destroy();
      // Trigger re-render by calling the effect again
      const newIsDark = getTheme();
      const newColors = getThemeColors(newIsDark);

      if (canvasRef.current) {
        chartRef.current = new Chart(canvasRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: data.map((p: number) => p >= 25 ? statusColors.green : statusColors.orange),
              borderRadius: 6,
              barThickness: 18,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => `${ctx.raw}% สำเร็จ`,
                },
              },
            },
            scales: {
              x: {
                max: 50,
                grid: { color: newColors.grid },
                ticks: { color: newColors.tick, callback: (v: number) => v + '%' },
              },
              y: {
                grid: { display: false },
                ticks: { color: newColors.label, font: { size: 11 } },
              },
            },
          },
          plugins: [{
            id: 'targetLine',
            afterDraw(chart: any) {
              const xScale = chart.scales.x;
              const x = xScale.getPixelForValue(25);
              const ctx = chart.ctx;
              ctx.save();
              ctx.setLineDash([5, 5]);
              ctx.strokeStyle = statusColors.red;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x, chart.chartArea.top);
              ctx.lineTo(x, chart.chartArea.bottom);
              ctx.stroke();
              ctx.fillStyle = statusColors.red;
              ctx.font = '10px Inter, sans-serif';
              ctx.fillText('Target Q1: 25%', x + 5, chart.chartArea.top + 10);
              ctx.restore();
            },
          }],
        });
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
      observer.disconnect();
    };
  }, [companies]);

  return <canvas ref={canvasRef} />;
}

interface StatusPieChartProps {
  done: number;
  notStarted: number;
  postponed: number;
  cancelled: number;
  notApplicable?: number;
}

export function StatusPieChart({ done, notStarted, postponed, cancelled, notApplicable = 0 }: StatusPieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    const isDark = getTheme();
    const colors = getThemeColors(isDark);

    const labels = ['เสร็จแล้ว', 'ยังไม่เริ่ม', 'เลื่อน', 'ยกเลิก', 'ไม่เข้าเงื่อนไข'];
    const data = [done, notStarted, postponed, cancelled, notApplicable];
    const chartColors = [statusColors.green, statusColors.orange, statusColors.infoBright, statusColors.red, statusColors.gray];

    // Filter out zero values for cleaner chart
    const filtered = labels.reduce((acc: { l: string[]; d: number[]; c: string[] }, label, idx) => {
      if (data[idx] > 0) {
        acc.l.push(label);
        acc.d.push(data[idx]);
        acc.c.push(chartColors[idx]);
      }
      return acc;
    }, { l: [], d: [], c: [] });

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: filtered.l,
        datasets: [{
          data: filtered.d,
          backgroundColor: filtered.c,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.legend, padding: 15, font: { size: 12 } },
          },
        },
      },
    });

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      if (chartRef.current) chartRef.current.destroy();
      const newIsDark = getTheme();
      const newColors = getThemeColors(newIsDark);

      if (canvasRef.current) {
        chartRef.current = new Chart(canvasRef.current, {
          type: 'doughnut',
          data: {
            labels: filtered.l,
            datasets: [{
              data: filtered.d,
              backgroundColor: filtered.c,
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: newColors.legend, padding: 15, font: { size: 12 } },
              },
            },
          },
        });
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
      observer.disconnect();
    };
  }, [done, notStarted, postponed, cancelled, notApplicable]);

  return <canvas ref={canvasRef} />;
}

export function BudgetChart({ companies }: RankingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    const isDark = getTheme();
    const colors = getThemeColors(isDark);

    const sorted = [...companies].sort((a, b) => a.budget - b.budget);
    const labels = sorted.map(c => c.shortName);
    const hasStacked = sorted.some(c => (c as any).safetyBudget != null || (c as any).enviBudget != null);

    // Build datasets: stacked if safety/envi data available, single otherwise
    const datasets = hasStacked ? [
      {
        label: 'Safety',
        data: sorted.map(c => (c as any).safetyBudget || 0),
        backgroundColor: 'rgba(255, 149, 0, 0.8)',
        borderColor: statusColors.orange,
        borderWidth: 1,
        borderRadius: 0,
        barThickness: 18,
        stack: 'budget',
      },
      {
        label: 'Environment',
        data: sorted.map(c => (c as any).enviBudget || 0),
        backgroundColor: 'rgba(52, 199, 89, 0.8)',
        borderColor: statusColors.green,
        borderWidth: 1,
        borderRadius: 0,
        barThickness: 18,
        stack: 'budget',
      },
    ] : [{
      label: 'งบประมาณ',
      data: sorted.map(c => c.budget),
      backgroundColor: statusColors.infoBright,
      borderRadius: 6,
      barThickness: 18,
    }];

    if (chartRef.current) chartRef.current.destroy();

    // Format budget value for display
    const fmtBudget = (v: number) => {
      if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
      return v.toLocaleString();
    };

    // Totals per bar for the label plugin
    const totals = sorted.map(c => c.budget);

    const buildChart = (themeColors: ReturnType<typeof getThemeColors>) => new Chart(canvasRef.current!, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 60 } },
        plugins: {
          legend: hasStacked ? {
            position: 'top',
            labels: { color: themeColors.legend, padding: 12, font: { size: 10 }, usePointStyle: true, pointStyle: 'rect' },
          } : { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const v = ctx.raw;
                return `${ctx.dataset.label}: ${fmtBudget(v)} บาท`;
              },
              afterBody: hasStacked ? (ctx: any) => {
                const idx = ctx[0].dataIndex;
                const c = sorted[idx];
                return `\nรวม: ${fmtBudget(c.budget)} บาท`;
              } : undefined,
            },
          },
        },
        scales: {
          x: {
            stacked: hasStacked,
            grid: { color: themeColors.grid },
            ticks: {
              color: themeColors.tick,
              callback: (v: number) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'K',
            },
          },
          y: {
            stacked: hasStacked,
            grid: { display: false },
            ticks: { color: themeColors.label, font: { size: 11 } },
          },
        },
      },
      plugins: [{
        id: 'totalLabels',
        afterDraw(chart: any) {
          const ctx = chart.ctx;
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          ctx.save();
          ctx.font = '11px Inter, sans-serif';
          ctx.fillStyle = themeColors.label;
          ctx.textBaseline = 'middle';
          totals.forEach((total: number, idx: number) => {
            if (total <= 0) return;
            const x = xScale.getPixelForValue(total);
            const y = yScale.getPixelForValue(idx);
            ctx.fillText(fmtBudget(total) + ' ฿', x + 6, y);
          });
          ctx.restore();
        },
      }],
    });

    chartRef.current = buildChart(colors);

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      if (chartRef.current) chartRef.current.destroy();
      const newColors = getThemeColors(getTheme());
      if (canvasRef.current) {
        chartRef.current = buildChart(newColors);
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
      observer.disconnect();
    };
  }, [companies]);

  return <canvas ref={canvasRef} />;
}

// Monthly Progress Chart — Plan vs Actual by month
interface MonthlyProgressChartProps {
  monthlyProgress: MonthlyProgress[];
}

export function MonthlyProgressChart({ monthlyProgress }: MonthlyProgressChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    const isDark = getTheme();
    const colors = getThemeColors(isDark);
    const currentMonth = new Date().getMonth();
    const labels = monthlyProgress.map(m => m.label);
    const planned = monthlyProgress.map(m => m.planned);

    // Per-status data for stacked Actual bars
    const doneData = monthlyProgress.map(m => m.doneCount ?? m.completed);
    const notApplicableData = monthlyProgress.map(m => m.notApplicableCount ?? 0);

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Plan (แผน)',
            data: planned,
            backgroundColor: 'rgba(0, 122, 255, 0.5)',
            borderColor: statusColors.blue,
            borderWidth: 1,
            borderRadius: 6,
            stack: 'plan',
          },
          {
            label: 'เสร็จแล้ว',
            data: doneData,
            backgroundColor: 'rgba(52, 199, 89, 0.8)',
            borderColor: statusColors.green,
            borderWidth: 1,
            borderRadius: 0,
            stack: 'actual',
          },
          {
            label: 'ไม่เข้าเงื่อนไข',
            data: notApplicableData,
            backgroundColor: 'rgba(142, 142, 147, 0.7)',
            borderColor: statusColors.gray,
            borderWidth: 1,
            borderRadius: 0,
            stack: 'actual',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.legend, padding: 12, font: { size: 10 }, usePointStyle: true, pointStyle: 'rect' },
          },
          tooltip: {
            callbacks: {
              afterBody: (ctx: any) => {
                const idx = ctx[0].dataIndex;
                const mp = monthlyProgress[idx];
                return mp.planned > 0 ? `\nCompletion: ${mp.pctComplete}%` : '';
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: {
              color: (ctx: any) => ctx.index <= currentMonth ? colors.label : colors.tick,
              font: { size: 11, weight: (ctx: any) => ctx.index === currentMonth ? 'bold' : 'normal' },
            },
          },
          y: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.tick },
            beginAtZero: true,
          },
        },
      },
      plugins: [{
        id: 'currentMonthLine',
        afterDraw(chart: any) {
          const xScale = chart.scales.x;
          const x = xScale.getPixelForValue(currentMonth);
          const ctx = chart.ctx;
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = statusColors.orange;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, chart.chartArea.top);
          ctx.lineTo(x, chart.chartArea.bottom);
          ctx.stroke();
          ctx.fillStyle = statusColors.orange;
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText('เดือนปัจจุบัน', x + 5, chart.chartArea.top + 10);
          ctx.restore();
        },
      }],
    });

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      if (chartRef.current) chartRef.current.destroy();
      const newIsDark = getTheme();
      const newColors = getThemeColors(newIsDark);

      if (canvasRef.current) {
        chartRef.current = new Chart(canvasRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Plan (แผน)',
                data: planned,
                backgroundColor: 'rgba(0, 122, 255, 0.5)',
                borderColor: statusColors.blue,
                borderWidth: 1,
                borderRadius: 6,
                stack: 'plan',
              },
              {
                label: 'เสร็จแล้ว',
                data: doneData,
                backgroundColor: 'rgba(52, 199, 89, 0.8)',
                borderColor: statusColors.green,
                borderWidth: 1,
                borderRadius: 0,
                stack: 'actual',
              },
              {
                label: 'ไม่เข้าเงื่อนไข',
                data: notApplicableData,
                backgroundColor: 'rgba(142, 142, 147, 0.7)',
                borderColor: statusColors.gray,
                borderWidth: 1,
                borderRadius: 0,
                stack: 'actual',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: { color: newColors.legend, padding: 12, font: { size: 10 }, usePointStyle: true, pointStyle: 'rect' },
              },
              tooltip: {
                callbacks: {
                  afterBody: (ctx: any) => {
                    const idx = ctx[0].dataIndex;
                    const mp = monthlyProgress[idx];
                    return mp.planned > 0 ? `\nCompletion: ${mp.pctComplete}%` : '';
                  },
                },
              },
            },
            scales: {
              x: {
                stacked: true,
                grid: { color: newColors.grid },
                ticks: {
                  color: (ctx: any) => ctx.index <= currentMonth ? newColors.label : newColors.tick,
                  font: { size: 11, weight: (ctx: any) => ctx.index === currentMonth ? 'bold' : 'normal' },
                },
              },
              y: {
                stacked: true,
                grid: { color: newColors.grid },
                ticks: { color: newColors.tick },
                beginAtZero: true,
              },
            },
          },
          plugins: [{
            id: 'currentMonthLine',
            afterDraw(chart: any) {
              const xScale = chart.scales.x;
              const x = xScale.getPixelForValue(currentMonth);
              const ctx = chart.ctx;
              ctx.save();
              ctx.setLineDash([4, 4]);
              ctx.strokeStyle = statusColors.orange;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x, chart.chartArea.top);
              ctx.lineTo(x, chart.chartArea.bottom);
              ctx.stroke();
              ctx.fillStyle = statusColors.orange;
              ctx.font = '10px Inter, sans-serif';
              ctx.fillText('เดือนปัจจุบัน', x + 5, chart.chartArea.top + 10);
              ctx.restore();
            },
          }],
        });
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
      observer.disconnect();
    };
  }, [monthlyProgress]);

  return <canvas ref={canvasRef} />;
}
