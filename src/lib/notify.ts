/**
 * Monthly digest notification engine
 *
 * Computes, per responsible person, the workload summary for the current month:
 *   "เดือนนี้มีแผน X รายการ, ค้าง Y รายการ"
 * and sends it by email via Resend (https://resend.com).
 *
 * Recipients are mapped in the `notification_recipients` table
 * (company_id + responsible_name → email), managed from the admin settings UI.
 */

import { getSupabase } from './supabase';
import { getCompanyForYearWithDb } from './company-settings';
import { fetchActivities, MONTH_KEYS } from './sheets';
import { Activity, MonthStatus } from './types';
import { DEFAULT_YEAR } from './companies';

const MONTH_LABELS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://eashe.org';

export interface NotificationRecipient {
  id: string;
  company_id: string;
  responsible_name: string;
  email: string;
  is_active: boolean;
  last_sent_at?: string | null;
}

export interface DigestItem {
  no: string;
  activity: string;
  planTag: 'S' | 'E' | '';
  kind: 'thisMonth' | 'overdue';
  overdueMonths: string; // "ม.ค., ก.พ." for overdue items
  doneThisMonth: boolean;
}

export interface PersonDigest {
  recipientId: string;
  companyId: string;
  companyName: string;
  responsibleName: string;
  email: string;
  monthLabel: string;
  year: number;
  thisMonthCount: number;   // แผนเดือนนี้ (รวมที่ทำแล้ว)
  thisMonthDone: number;    // ทำแล้วในเดือนนี้
  overdueCount: number;     // ค้างจากเดือนก่อน (จำนวนกิจกรรม)
  items: DigestItem[];
}

// ── Current month index in Asia/Bangkok (server may run in UTC) ──
export function currentMonthIdxBangkok(): number {
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', month: 'numeric' }).format(new Date());
  return parseInt(m, 10) - 1;
}

type TaggedActivity = Activity & { _planTag: 'S' | 'E' };

// ── Build effective-status helper from overrides ──
function makeGetEffectiveStatus(
  overrides: Record<string, string>,
  currentMonthIdx: number,
) {
  return (act: TaggedActivity, monthKey: string): MonthStatus => {
    const key = `${act._planTag}:${act.no}:${monthKey}`;
    if (overrides[key]) return overrides[key] as MonthStatus;
    const base = act.monthStatuses?.[monthKey] || 'not_planned';
    // Auto-detect overdue: planned in a past month with no actual
    if (base === 'planned' && MONTH_KEYS.indexOf(monthKey) < currentMonthIdx && !act.isConditional) {
      return 'overdue';
    }
    return base;
  };
}

// ── Compute digests for one company's recipients ──
export async function computeCompanyDigests(
  companyId: string,
  recipients: NotificationRecipient[],
  year: number = DEFAULT_YEAR,
): Promise<PersonDigest[]> {
  if (recipients.length === 0) return [];

  const company = await getCompanyForYearWithDb(companyId, year);
  if (!company || !company.sheetId) return [];

  const sb = getSupabase();

  // Fetch activities (both plans) + overrides in parallel
  const [safetyActs, enviActs, statusRes, respRes] = await Promise.all([
    company.safetySheet ? fetchActivities(company, company.safetySheet).catch(() => [] as Activity[]) : Promise.resolve([] as Activity[]),
    company.enviSheet ? fetchActivities(company, company.enviSheet).catch(() => [] as Activity[]) : Promise.resolve([] as Activity[]),
    sb.from('status_overrides').select('activity_no,month,status,plan_type').eq('company_id', companyId),
    sb.from('responsible_overrides').select('activity_no,responsible,plan_type').eq('company_id', companyId),
  ]);

  const activities: TaggedActivity[] = [
    ...safetyActs.map(a => ({ ...a, _planTag: 'S' as const })),
    ...enviActs.map(a => ({ ...a, _planTag: 'E' as const })),
  ];
  if (activities.length === 0) return [];

  const statusOverrides: Record<string, string> = {};
  (statusRes.data || []).forEach((o: { activity_no: string; month: string; status: string; plan_type: string }) => {
    if (o.status && o.status !== '__noted__') {
      statusOverrides[`${o.plan_type === 'safety' ? 'S' : 'E'}:${o.activity_no}:${o.month}`] = o.status;
    }
  });

  const respOverrides: Record<string, string> = {};
  (respRes.data || []).forEach((o: { activity_no: string; responsible: string; plan_type: string }) => {
    respOverrides[`${o.plan_type === 'safety' ? 'S' : 'E'}:${o.activity_no}`] = o.responsible;
  });

  const curIdx = currentMonthIdxBangkok();
  const curMK = MONTH_KEYS[curIdx];
  const getStatus = makeGetEffectiveStatus(statusOverrides, curIdx);
  const getResponsible = (act: TaggedActivity): string =>
    respOverrides[`${act._planTag}:${act.no}`] || act.responsible || '';

  const norm = (s: string) => s.trim().toLowerCase();

  return recipients.map(recipient => {
    const nameNorm = norm(recipient.responsible_name);
    const mine = activities.filter(act => nameNorm !== '' && norm(getResponsible(act)).includes(nameNorm));

    let thisMonthCount = 0;
    let thisMonthDone = 0;
    let overdueCount = 0;
    const items: DigestItem[] = [];

    mine.forEach(act => {
      const curStatus = getStatus(act, curMK);
      const hasThisMonth = curStatus !== 'not_planned' && curStatus !== 'cancelled' && curStatus !== 'not_applicable';

      const overdueMonths = act.isConditional ? [] : MONTH_KEYS.filter((mk, idx) => {
        if (idx >= curIdx) return false;
        const st = getStatus(act, mk);
        return st === 'overdue' || st === 'planned';
      });

      if (hasThisMonth) {
        thisMonthCount++;
        if (curStatus === 'done') thisMonthDone++;
      }
      if (overdueMonths.length > 0) overdueCount++;

      if (hasThisMonth || overdueMonths.length > 0) {
        items.push({
          no: act.no,
          activity: act.activity,
          planTag: act._planTag,
          kind: overdueMonths.length > 0 ? 'overdue' : 'thisMonth',
          overdueMonths: overdueMonths.map(mk => MONTH_LABELS_TH[MONTH_KEYS.indexOf(mk)]).join(', '),
          doneThisMonth: curStatus === 'done',
        });
      }
    });

    // Overdue items first, then this-month items
    items.sort((a, b) => (b.kind === 'overdue' ? 1 : 0) - (a.kind === 'overdue' ? 1 : 0));

    return {
      recipientId: recipient.id,
      companyId,
      companyName: company.shortName || company.name,
      responsibleName: recipient.responsible_name,
      email: recipient.email,
      monthLabel: MONTH_LABELS_TH[curIdx],
      year,
      thisMonthCount,
      thisMonthDone,
      overdueCount,
      items,
    };
  });
}

// ── Render email HTML ──
export function renderDigestEmail(d: PersonDigest): { subject: string; html: string } {
  const subject = `[EA SHE] ${d.companyName} — แผนงานเดือน ${d.monthLabel}: มีแผน ${d.thisMonthCount} รายการ, ค้าง ${d.overdueCount} รายการ`;
  const link = `${SITE_URL}/projects/action-plan/${d.companyId}`;
  const maxItems = 20;
  const shown = d.items.slice(0, maxItems);

  const rows = shown.map(it => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#555;white-space:nowrap;">
        ${it.planTag === 'S' ? '🛡️' : '🌿'} ${it.no}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#333;">
        ${escapeHtml(it.activity)}
        ${it.kind === 'overdue' ? `<div style="color:#d9534f;font-size:11px;margin-top:2px;">⚠️ ค้างจากเดือน: ${it.overdueMonths}</div>` : ''}
        ${it.doneThisMonth ? `<div style="color:#2e9e5b;font-size:11px;margin-top:2px;">✓ เดือนนี้ทำแล้ว</div>` : ''}
      </td>
    </tr>`).join('');

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
    <div style="background:#1a73e8;background:linear-gradient(135deg,#16a085,#1a73e8);padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="color:#fff;font-size:18px;font-weight:700;">EA SHE Dashboard — สรุปแผนงานประจำเดือน ${d.monthLabel} ${d.year + 543}</div>
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">${escapeHtml(d.companyName)} • คุณ${escapeHtml(d.responsibleName)}</div>
    </div>
    <div style="padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="text-align:center;padding:12px;background:#f0f7ff;border-radius:8px;">
            <div style="font-size:26px;font-weight:700;color:#1a73e8;">${d.thisMonthCount}</div>
            <div style="font-size:12px;color:#666;">แผนเดือนนี้</div>
          </td>
          <td style="width:8px;"></td>
          <td style="text-align:center;padding:12px;background:#f0faf4;border-radius:8px;">
            <div style="font-size:26px;font-weight:700;color:#2e9e5b;">${d.thisMonthDone}</div>
            <div style="font-size:12px;color:#666;">ทำแล้ว</div>
          </td>
          <td style="width:8px;"></td>
          <td style="text-align:center;padding:12px;background:${d.overdueCount > 0 ? '#fdf2f2' : '#f7f7f7'};border-radius:8px;">
            <div style="font-size:26px;font-weight:700;color:${d.overdueCount > 0 ? '#d9534f' : '#999'};">${d.overdueCount}</div>
            <div style="font-size:12px;color:#666;">ค้างสะสม</div>
          </td>
        </tr>
      </table>
      ${shown.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
      ${d.items.length > maxItems ? `<div style="font-size:12px;color:#888;margin-top:8px;">…และอีก ${d.items.length - maxItems} รายการ</div>` : ''}
      ` : `<div style="text-align:center;color:#2e9e5b;font-size:14px;padding:12px 0;">🎉 ไม่มีงานเดือนนี้และไม่มีงานค้าง</div>`}
      <div style="text-align:center;margin-top:20px;">
        <a href="${link}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          เปิดแผนงาน ${escapeHtml(d.companyName)}
        </a>
      </div>
      <div style="font-size:11px;color:#aaa;margin-top:20px;text-align:center;">
        อีเมลนี้ส่งอัตโนมัติทุกต้นเดือนจาก EA SHE Dashboard (eashe.org)
      </div>
    </div>
  </div>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Send email via Resend ──
export async function sendEmail(to: string, subject: string, html: string): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const from = process.env.NOTIFY_FROM_EMAIL || 'EA SHE Dashboard <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}
