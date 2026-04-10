/**
 * Auto-sync project completion_pct from its milestones.
 * Called after any milestone create / update / delete.
 *
 * Formula: average of all milestones' completion_pct (excluding cancelled).
 * If no milestones remain → 0%.
 * Returns the updated project row (or null on error).
 */
export async function syncProjectFromMilestones(
  supabase: ReturnType<typeof import('@/lib/supabase').getSupabase>,
  projectId: string
) {
  try {
    // Fetch all milestones for this project
    const { data: milestones, error: msError } = await supabase
      .from('project_milestones')
      .select('completion_pct, status')
      .eq('project_id', projectId);

    if (msError) {
      console.error('[project-sync] milestone fetch error:', msError.message);
      return null;
    }

    // Filter out cancelled milestones for the average
    const active = (milestones || []).filter(m => m.status !== 'cancelled');
    const avgPct = active.length > 0
      ? Math.round(active.reduce((sum, m) => sum + (m.completion_pct || 0), 0) / active.length)
      : 0;

    // Update the project's completion_pct
    const { data: project, error: projError } = await supabase
      .from('special_projects')
      .update({ completion_pct: avgPct })
      .eq('id', projectId)
      .select()
      .single();

    if (projError) {
      console.error('[project-sync] project update error:', projError.message);
      return null;
    }

    return project;
  } catch (e) {
    console.error('[project-sync] unexpected error:', e);
    return null;
  }
}
