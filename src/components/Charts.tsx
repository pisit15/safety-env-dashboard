'use client';

import { useEffect, useRef } from 'react';
import { CompanySummary } from '@/lib/types';

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

export function StatusPieChart({ done, inProgress, notStarted }: { done: number; inProgress: number; notStarted: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: ['ดำเนินการแล้ว', 'กำลังดำเนินการ', 'ยังไม่เริ่ม'],
        datasets: [{
          data: [done, inProgress, notStarted],
          backgroundColor: ['#4ade80', '#fbbf24', '#fb923c'],
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
  }, [done, inProgress, notStarted]);

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
