/**
 * Monthly digest sender
 *
 * GET  — Vercel Cron entrypoint (1st of month, 08:00 ICT). Sends the digest
 *        email to every active recipient. Protected by CRON_SECRET when set.
 * POST — Manual trigger from the admin settings UI:
 *        { recipientId }            → send a test digest to one recipient
 *        { companyId, dryRun:true } → preview computed digests without sending
 *        { sendAll: true }          → same as cron run (manual "ส่งตอนนี้")
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  NotificationRecipient,
  computeCompanyDigests,
  renderDigestEmail,
  sendEmail,
} from '@/lib/notify';
import { DEFAULT_YEAR } from '@/lib/companies';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SendResult {
  email: string;
  responsibleName: string;
  companyId: string;
  status: 'sent' | 'error' | 'skipped';
  detail?: string;
}

async function runDigest(opts: {
  companyId?: string;
  recipientId?: string;
  dryRun?: boolean;
  testPrefix?: boolean;
}): Promise<{ results: SendResult[]; digests?: unknown[] }> {
  const sb = getSupabase();

  let query = sb.from('notification_recipients').select('*').eq('is_active', true);
  if (opts.companyId) query = query.eq('company_id', opts.companyId);
  if (opts.recipientId) query = query.eq('id', opts.recipientId);

  const { data: recipients, error } = await query;
  if (error) throw new Error(error.message);
  if (!recipients || recipients.length === 0) {
    return { results: [], digests: [] };
  }

  // Group recipients by company so each company's sheets are fetched once
  const byCompany: Record<string, NotificationRecipient[]> = {};
  (recipients as NotificationRecipient[]).forEach(r => {
    (byCompany[r.company_id] = byCompany[r.company_id] || []).push(r);
  });

  const results: SendResult[] = [];
  const allDigests: unknown[] = [];

  for (const [companyId, companyRecipients] of Object.entries(byCompany)) {
    let digests;
    try {
      digests = await computeCompanyDigests(companyId, companyRecipients, DEFAULT_YEAR);
    } catch (err) {
      companyRecipients.forEach(r => results.push({
        email: r.email, responsibleName: r.responsible_name, companyId,
        status: 'error', detail: `compute failed: ${err instanceof Error ? err.message : String(err)}`,
      }));
      continue;
    }

    for (const digest of digests) {
      allDigests.push(digest);
      if (opts.dryRun) {
        results.push({
          email: digest.email, responsibleName: digest.responsibleName, companyId,
          status: 'skipped', detail: `dryRun — แผน ${digest.thisMonthCount}, ค้าง ${digest.overdueCount}`,
        });
        continue;
      }

      try {
        const { subject, html } = renderDigestEmail(digest);
        const finalSubject = opts.testPrefix ? `[ทดสอบ] ${subject}` : subject;
        await sendEmail(digest.email, finalSubject, html);
        await sb.from('notification_recipients')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', digest.recipientId);
        results.push({
          email: digest.email, responsibleName: digest.responsibleName, companyId,
          status: 'sent', detail: `แผน ${digest.thisMonthCount}, ค้าง ${digest.overdueCount}`,
        });
      } catch (err) {
        results.push({
          email: digest.email, responsibleName: digest.responsibleName, companyId,
          status: 'error', detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { results, digests: opts.dryRun ? allDigests : undefined };
}

// ── GET: Vercel Cron entrypoint ──
export async function GET(request: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the env var is set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { results } = await runDigest({});
    const sent = results.filter(r => r.status === 'sent').length;
    const errors = results.filter(r => r.status === 'error');
    console.log(`[monthly-digest] sent=${sent} errors=${errors.length}`);
    return NextResponse.json({ ok: true, sent, errors });
  } catch (error) {
    console.error('[monthly-digest] cron error:', error);
    return NextResponse.json({ error: 'Digest run failed' }, { status: 500 });
  }
}

// ── POST: manual trigger / test / preview from admin UI ──
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { recipientId, companyId, dryRun, sendAll } = body as {
      recipientId?: string; companyId?: string; dryRun?: boolean; sendAll?: boolean;
    };

    if (!recipientId && !dryRun && !sendAll) {
      return NextResponse.json({ error: 'ระบุ recipientId, dryRun หรือ sendAll' }, { status: 400 });
    }

    const { results, digests } = await runDigest({
      recipientId,
      companyId,
      dryRun: !!dryRun,
      testPrefix: !!recipientId, // single-recipient sends are tests
    });

    const sent = results.filter(r => r.status === 'sent').length;
    return NextResponse.json({ ok: true, sent, results, digests });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
