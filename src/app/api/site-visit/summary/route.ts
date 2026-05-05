import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('company_id');
    const db = getSupabase();

    // Fetch completed assessments
    let assessQuery = db
      .from('site_visit_assessments')
      .select('*')
      .eq('status', 'completed')
      .order('assessment_date', { ascending: false });
    if (companyId) {
      assessQuery = assessQuery.eq('company_id', companyId);
    }
    const { data: assessments, error: aErr } = await assessQuery;
    if (aErr) throw aErr;

    // If no assessments, return empty
    if (!assessments || assessments.length === 0) {
      return NextResponse.json({ data: { assessments: [], categoryScores: [], companies: [] } });
    }

    // Fetch all responses for these assessments
    const assessIds = assessments.map(a => a.id);
    const { data: responses, error: rErr } = await db
      .from('site_visit_responses')
      .select('*, site_visit_items(category_id, max_score, question)')
      .in('assessment_id', assessIds);
    if (rErr) throw rErr;

    // Fetch categories
    const { data: categories, error: cErr } = await db
      .from('site_visit_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (cErr) throw cErr;

    // Compute category-level scores per assessment
    const categoryScores = assessments.map(a => {
      const aResponses = (responses || []).filter(r => r.assessment_id === a.id);
      const catMap: Record<number, { score: number; maxScore: number; count: number }> = {};

      for (const r of aResponses) {
        if (r.is_na || !r.site_visit_items) continue;
        const catId = r.site_visit_items.category_id;
        if (!catMap[catId]) catMap[catId] = { score: 0, maxScore: 0, count: 0 };
        catMap[catId].score += r.score || 0;
        catMap[catId].maxScore += r.site_visit_items.max_score || 0;
        catMap[catId].count += 1;
      }

      return {
        assessment_id: a.id,
        company_id: a.company_id,
        assessment_date: a.assessment_date,
        assessment_type: a.assessment_type,
        assessor_name: a.assessor_name,
        total_score: a.total_score,
        max_possible_score: a.max_possible_score,
        categories: Object.entries(catMap).map(([catId, v]) => ({
          category_id: parseInt(catId),
          score: v.score,
          max_score: v.maxScore,
          count: v.count,
          percent: v.maxScore > 0 ? Math.round((v.score / v.maxScore) * 100) : 0,
        })),
      };
    });

    // Unique companies
    const companies = Array.from(new Set(assessments.map(a => a.company_id)));

    return NextResponse.json({
      data: {
        assessments,
        categoryScores,
        categories: categories || [],
        companies,
      },
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
