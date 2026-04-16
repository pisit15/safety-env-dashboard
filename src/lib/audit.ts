import { getServiceSupabase } from '@/lib/supabase';

/**
 * Server-side audit logging helper.
 * Call directly from API routes — no HTTP overhead.
 */
export type AuditModule =
  | 'action-plan'
  | 'incidents'
  | 'nearmiss'
  | 'training'
  | 'risk'
  | 'special-projects'
  | 'employees'
  | 'admin';

export interface AuditParams {
  companyId: string;
  module: AuditModule;
  action: string; // e.g. 'create_incident', 'update_status', 'delete_report'
  performedBy: string;
  planType?: string;
  activityNo?: string;
  month?: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
}

/**
 * Log an audit entry. Fails silently to never block the main operation.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('audit_log').insert({
      company_id: params.companyId,
      plan_type: params.planType || params.module,
      action: params.action,
      activity_no: params.activityNo || '',
      month: params.month || '',
      old_value: params.oldValue || '',
      new_value: params.newValue || '',
      note: params.note || '',
      performed_by: params.performedBy,
    });
  } catch {
    // Silently fail — audit should never break the main operation
    console.error('[audit] Failed to log:', params.action);
  }
}
