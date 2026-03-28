'use client';

import { useEffect, useRef } from 'react';
import { CompanySummary, MonthlyProgress } from '@/lib/types';

declare const Chart: any;

interface RankingChartProps {
  companies: CompanySummary[];
}

export function RankingChart({ companies }: RankingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

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
          backgroundColor: data.map((p: number) => p >= 25 ? '#4ade80' : '#fb923c'),
          borderRadius: 4,
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
            grid: { color: '#27272a' },
            ticks: { color: '#71717a', callback: (v: number) => v + '%' },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#fafafa', font: { size: 11 } },
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
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, chart.chartArea.top);
          ctx.lineTo(x, chart.chartArea.bottom);
          ctx.stroke();
          ctx.fillStyle = '#ef4444';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText('Target Q1: 25%', x + 5, chart.chartArea.top + 10);
          ctx.restore();
        },
      }],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
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
    if (chartRef.current) chartRef.current.destroy();

    const labels = ['เสร็จแล้ว', 'ยังไม่เริ่ม', 'เลื่อน', 'ยกเลิก', 'ไม่เข้าเงื่อนไข'];
    const data = [done, notStarted, postponed, cancelled, notApplicable];
    const colors = ['#4ade80', '#fb923c', '#60a5fa', '#f87171', '#71717a'];

    // Filter out zero values for cleaner chart
    const filtered = labels.reduce((acc: { l: string[]; d: number[]; c: string[] }, label, idx) => {
      if (data[idx] > 0) {
        acc.l.push(label);
        acc.d.push(data[idx]);
        acc.c.push(colors[idx]);
      }
      return acc;
    }, { l: [], d: [], c: [] });

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
            labels: { color: '#a1a1aa', padding: 15, font: { size: 12 } },
          },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [done, notStarted, postponed, cancelled, notApplicable]);

  return <canvas ref={canvasRef} />;
}

export function BudgetChart({ companies }: RankingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    const sorted = [...companies].sort((a, b) => a.budget - b.budget);
    const labels = sorted.map(c => c.shortName);
    const data = sorted.map(c => c.budget);

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          barThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: '#27272a' },
            ticks: {
              color: '#71717a',
              callback: (v: number) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'K',
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#fafafa', font: { size: 11 } },
          },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
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
    if (chartRef.current) chartRef.current.destroy();

    const currentMonth = new Date().getMonth();
    const labels = monthlyProgress.map(m => m.label);
    const planned = monthlyProgress.map(m => m.planned);

    // Per-status data for stacked Actual bars
    const doneData = monthlyProgress.map(m => m.doneCount ?? m.completed);
    const notApplicableData = monthlyProgress.map(m => m.notApplicableCount ?? 0);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Plan (แผน)',
            data: planned,
            backgroundColor: 'rgba(99, 102, 241, 0.5)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'plan',
          },
          {
            label: 'เสร็จแล้ว',
            data: doneData,
            backgroundColor: 'rgba(74, 222, 128, 0.8)',
            borderColor: '#4ade80',
            borderWidth: 1,
            borderRadius: 0,
            stack: 'actual',
          },
          {
            label: 'ไม่เข้าเงื่อนไข',
            data: notApplicableData,
            backgroundColor: 'rgba(113, 113, 122, 0.7)',
            borderColor: '#71717a',
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
            labels: { color: '#a1a1aa', padding: 12, font: { size: 10 }, usePointStyle: true, pointStyle: 'rect' },
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
            grid: { color: '#27272a' },
            ticks: {
              color: (ctx: any) => ctx.index <= currentMonth ? '#fafafa' : '#52525b',
              font: { size: 11, weight: (ctx: any) => ctx.index === currentMonth ? 'bold' : 'normal' },
            },
          },
          y: {
            stacked: true,
            grid: { color: '#27272a' },
            ticks: { color: '#71717a' },
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
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, chart.chartArea.top);
          ctx.lineTo(x, chart.chartArea.bottom);
          ctx.stroke();
          ctx.fillStyle = '#f59e0b';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText('เดือนปัจจุบัน', x + 5, chart.chartArea.top + 10);
          ctx.restore();
        },
      }],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [monthlyProgress]);

  return <canvas ref={canvasRef} />;
}
