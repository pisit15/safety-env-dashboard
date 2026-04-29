'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { COMPANIES } from '@/lib/companies';

type Assessment = {
  id: number;
  company_id: string;
  assessment_date: string;
  assessment_type: string;
  assessor_name: string | null;
  auditee_name: string | null;
  status: string;
  total_score: number | null;
  max_possible_score: number | null;
  notes: string | null;
  created_at: string;
};

const VIZ = {
  primary: '#0f766e',
  secondary: '#f97316',
  accent: '#dc2626',
  positive: '#16a34a',
  neutral: '#a3a3a3',
  muted: '#e5e7eb',
  bg: '#f9fafb',
  text: '#1f2937',
  lightText: '#6b7280',
};

export default function AssessmentHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const auth = useAuth();
  const companyId = params.companyId as string;

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const companyName =
    COMPANIES.find((x) => x.id === companyId)?.name || companyId.toUpperCase();

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/site-visit/assessments?company_id=${companyId}`
      );
      if (!res.ok) throw new Error('Failed to fetch assessments');
      const { data } = await res.json();
      setAssessments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!auth) {
      router.push('/login');
      return;
    }
    fetchAssessments();
  }, [auth, companyId, router, fetchAssessments]);

  if (!auth) return null;

  const totalAssessments = assessments.length;
  const completedAssessments = assessments.filter(
    (a) => a.status === 'completed'
  ).length;
  const latestAssessment = assessments[0];
  const scores = assessments
    .filter((a) => a.total_score !== null && a.max_possible_score !== null)
    .map((a) => (a.max_possible_score! > 0 ? (a.total_score! / a.max_possible_score!) * 100 : 0))
    .sort((a, b) => a - b);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  const getTrendArrow = () => {
    if (scores.length < 2) return '—';
    const recent = scores[scores.length - 1];
    const previous = scores[scores.length - 2];
    if (recent > previous) return '↗';
    if (recent < previous) return '↘';
    return '→';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: VIZ.text }}>
            Assessment History
          </h1>
          <p style={{ color: VIZ.lightText }} className="mt-2">
            {companyName}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p style={{ color: VIZ.accent }}>Error: {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div
            className="bg-white rounded-lg border p-4"
            style={{ borderLeft: `4px solid ${VIZ.primary}` }}
          >
            <p style={{ color: VIZ.lightText }} className="text-sm">
              Total Assessments
            </p>
            <p className="text-3xl font-bold" style={{ color: VIZ.primary }}>
              {totalAssessments}
            </p>
          </div>

          <div
            className="bg-white rounded-lg border p-4"
            style={{ borderLeft: `4px solid ${VIZ.positive}` }}
          >
            <p style={{ color: VIZ.lightText }} className="text-sm">
              Completed
            </p>
            <p className="text-3xl font-bold" style={{ color: VIZ.positive }}>
              {completedAssessments}
            </p>
          </div>

          <div
            className="bg-white rounded-lg border p-4"
            style={{ borderLeft: `4px solid ${VIZ.secondary}` }}
          >
            <p style={{ color: VIZ.lightText }} className="text-sm">
              Latest Score
            </p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold" style={{ color: VIZ.secondary }}>
                {latestAssessment
                  ? Math.round(
                      (latestAssessment.total_score! /
                        (latestAssessment.max_possible_score! || 1)) *
                        100
                    )
                  : '—'}
              </p>
              <p className="text-lg" style={{ color: VIZ.lightText }}>
                %
              </p>
            </div>
          </div>

          <div
            className="bg-white rounded-lg border p-4"
            style={{ borderLeft: `4px solid ${VIZ.primary}` }}
          >
            <p style={{ color: VIZ.lightText }} className="text-sm">
              Avg Score
            </p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold" style={{ color: VIZ.primary }}>
                {avgScore}
              </p>
              <p className="text-lg" style={{ color: VIZ.lightText }}>
                % {getTrendArrow()}
              </p>
            </div>
          </div>
        </div>

        {scores.length > 1 && (
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: VIZ.text }}>
              Score Trend
            </h2>
            <svg viewBox="0 0 800 200" className="w-full">
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VIZ.primary} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={VIZ.primary} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[20, 40, 60, 80].map((y) => (
                <line
                  key={`grid-${y}`}
                  x1="40"
                  y1={180 - (y * 160) / 100}
                  x2="780"
                  y2={180 - (y * 160) / 100}
                  stroke={VIZ.muted}
                  strokeWidth="1"
                />
              ))}
              {/* Y-axis labels */}
              {[0, 20, 40, 60, 80, 100].map((y) => (
                <text
                  key={`y-label-${y}`}
                  x="35"
                  y={185 - (y * 160) / 100}
                  textAnchor="end"
                  fontSize="12"
                  fill={VIZ.lightText}
                >
                  {y}%
                </text>
              ))}
              {/* Y-axis */}
              <line x1="40" y1="20" x2="40" y2="180" stroke={VIZ.neutral} strokeWidth="2" />
              {/* X-axis */}
              <line x1="40" y1="180" x2="780" y2="180" stroke={VIZ.neutral} strokeWidth="2" />
              {/* Bars */}
              {scores.map((score, idx) => {
                const barWidth = 700 / scores.length;
                const barHeight = (score * 160) / 100;
                const x = 40 + idx * barWidth + barWidth * 0.1;
                const y = 180 - barHeight;
                const color =
                  score >= 80
                    ? VIZ.positive
                    : score >= 60
                      ? VIZ.secondary
                      : VIZ.accent;
                return (
                  <rect
                    key={`bar-${idx}`}
                    x={x}
                    y={y}
                    width={barWidth * 0.8}
                    height={barHeight}
                    fill={color}
                    opacity="0.8"
                  />
                );
              })}
            </svg>
          </div>
        )}

        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold" style={{ color: VIZ.text }}>
              Assessments
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <p style={{ color: VIZ.lightText }}>Loading...</p>
            </div>
          ) : assessments.length === 0 ? (
            <div className="p-6 text-center">
              <p style={{ color: VIZ.lightText }}>No assessments found</p>
            </div>
          ) : (
            <div className="divide-y">
              {assessments.map((assessment) => {
                const percentage =
                  assessment.max_possible_score! > 0
                    ? Math.round(
                        (assessment.total_score! / assessment.max_possible_score!) * 100
                      )
                    : 0;
                const isExpanded = expandedId === assessment.id;
                return (
                  <div key={assessment.id}>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : assessment.id)
                      }
                      className="w-full p-4 text-left hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: VIZ.text }}>
                            {assessment.assessment_type}
                          </p>
                          <p style={{ color: VIZ.lightText }} className="text-sm">
                            {new Date(
                              assessment.assessment_date
                            ).toLocaleDateString()}
                            {assessment.assessor_name &&
                              ` • ${assessment.assessor_name}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold" style={{ color: VIZ.primary }}>
                            {percentage}%
                          </p>
                          <p style={{ color: VIZ.lightText }} className="text-sm">
                            {assessment.status}
                          </p>
                        </div>
                        <p className="ml-4" style={{ color: VIZ.lightText }}>
                          {isExpanded ? '▼' : '▶'}
                        </p>
                      </div>
                    </button>
                    {isExpanded && (
                      <div
                        className="p-4 bg-gray-50 text-sm border-t"
                        style={{ borderColor: VIZ.muted }}
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p style={{ color: VIZ.lightText }} className="text-xs">
                              Auditee
                            </p>
                            <p style={{ color: VIZ.text }}>
                              {assessment.auditee_name || '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ color: VIZ.lightText }} className="text-xs">
                              Score
                            </p>
                            <p style={{ color: VIZ.text }}>
                              {assessment.total_score} /{' '}
                              {assessment.max_possible_score}
                            </p>
                          </div>
                        </div>
                        {assessment.notes && (
                          <div className="mt-3">
                            <p style={{ color: VIZ.lightText }} className="text-xs">
                              Notes
                            </p>
                            <p style={{ color: VIZ.text }}>{assessment.notes}</p>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            router.push(
                              `/projects/site-visit/${companyId}/detail?assessmentId=${assessment.id}`
                            )
                          }
                          className="mt-3 px-3 py-1 text-sm font-medium rounded"
                          style={{
                            color: 'white',
                            backgroundColor: VIZ.primary,
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
