import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCompanyById } from '@/lib/companies';
import { getCompanyByIdWithDb } from '@/lib/company-settings';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Helper: Look up multi-company access for a user and return linked company login data.
 */
async function getLinkedCompanies(masterUsername: string, masterCompanyId: string) {
  const supabase = getSupabase();
  try {
    const { data: mappings, error } = await supabase
      .from('user_company_access')
      .select('access_company_id, display_name')
      .eq('master_username', masterUsername)
      .eq('master_company_id', masterCompanyId)
      .eq('is_active', true);

    if (error || !mappings || mappings.length === 0) return [];

    const linked: Array<{
      companyId: string;
      companyName: string;
      displayName: string;
      username: string;
      token: string;
    }> = [];

    for (const m of mappings) {
      const accessCompanyId = m.access_company_id;
      const company = await getCompanyByIdWithDb(accessCompanyId);
      const companyName = company?.name || accessCompanyId.toUpperCase();
      const token = Buffer.from(`${accessCompanyId}:${masterUsername}:${Date.now()}`).toString('base64');
      linked.push({
        companyId: accessCompanyId,
        companyName,
        displayName: m.display_name || masterUsername,
        username: masterUsername,
        token,
      });
    }

    return linked;
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: { companyId?: string; password?: string; username?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { companyId, password, username } = body;

    if (!companyId || !password) {
      return NextResponse.json({ error: 'Missing companyId or password' }, { status: 400 });
    }

    const company = await getCompanyByIdWithDb(companyId);

    // ── 1. Try company_users table first (multi-user system) ──
    try {
      let query = getSupabase()
        .from('company_users')
        .select('id, company_id, username, password, display_name, is_active')
        .eq('company_id', companyId);

      // If username provided, match by username + password
      // If not, match by password only (backward compatible)
      if (username) {
        query = query.eq('username', username);
      }

      const { data: users, error: usersErr } = await query;

      if (!usersErr && users && users.length > 0) {
        // Find matching user by password
        const matched = users.find((u: any) => u.password === password);
        if (matched) {
          if (!matched.is_active) {
            return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
          }
          const token = Buffer.from(`${companyId}:${matched.username}:${Date.now()}`).toString('base64');

          // Lookup linked companies for multi-company access
          const linkedCompanies = await getLinkedCompanies(matched.username, companyId);

          return NextResponse.json({
            success: true,
            companyId: matched.company_id,
            companyName: company?.name || matched.company_id.toUpperCase(),
            username: matched.username,
            displayName: matched.display_name || matched.username,
            token,
            linkedCompanies,
          });
        }
        // Users exist for this company but password didn't match
        return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }
    } catch {
      // Table might not exist — fall through
    }

    // ── 1b. Reverse multi-company lookup ──
    // User might be trying to login to a LINKED company directly.
    // Check if there's a user_company_access mapping where access_company_id = current companyId,
    // then verify credentials against the MASTER company.
    try {
      const { data: reverseMappings } = await getSupabase()
        .from('user_company_access')
        .select('master_username, master_company_id, display_name')
        .eq('access_company_id', companyId)
        .eq('is_active', true);

      if (reverseMappings && reverseMappings.length > 0) {
        for (const rm of reverseMappings) {
          // Only check if username matches (or no username provided)
          if (username && rm.master_username.toLowerCase() !== username.toLowerCase()) continue;

          // Try to authenticate against the master company
          const { data: masterUsers } = await getSupabase()
            .from('company_users')
            .select('id, company_id, username, password, display_name, is_active')
            .eq('company_id', rm.master_company_id)
            .eq('username', rm.master_username);

          if (masterUsers && masterUsers.length > 0) {
            const masterUser = masterUsers.find((u: any) => u.password === password);
            if (masterUser && masterUser.is_active) {
              // Authenticated via master company — grant access to this linked company
              const token = Buffer.from(`${companyId}:${masterUser.username}:${Date.now()}`).toString('base64');
              const masterCompany = await getCompanyByIdWithDb(rm.master_company_id);

              // Also get all linked companies for this user (including the master company itself)
              const allLinked = await getLinkedCompanies(masterUser.username, rm.master_company_id);

              // Add master company to linked list
              const masterToken = Buffer.from(`${rm.master_company_id}:${masterUser.username}:${Date.now()}`).toString('base64');
              const linkedCompanies = [
                {
                  companyId: rm.master_company_id,
                  companyName: masterCompany?.name || rm.master_company_id.toUpperCase(),
                  displayName: masterUser.display_name || masterUser.username,
                  username: masterUser.username,
                  token: masterToken,
                },
                // Add other linked companies except the current one (which is the primary login)
                ...allLinked.filter(l => l.companyId !== companyId),
              ];

              return NextResponse.json({
                success: true,
                companyId,
                companyName: company?.name || companyId.toUpperCase(),
                username: masterUser.username,
                displayName: rm.display_name || masterUser.display_name || masterUser.username,
                token,
                linkedCompanies,
              });
            }
          }
        }
      }
    } catch {
      // Table might not exist — fall through
    }

    // ── 2. Fallback: company_credentials (legacy single-user) ──
    const { data: cred, error: credErr } = await getSupabase()
      .from('company_credentials')
      .select('company_id, username, password, is_active')
      .eq('company_id', companyId)
      .single();

    if (!credErr && cred) {
      if (!cred.is_active) {
        return NextResponse.json({ error: 'บัญชีถูกปิดใช้งาน' }, { status: 401 });
      }
      if (cred.password !== password) {
        return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
      }
      const token = Buffer.from(`${companyId}:${cred.username}:${Date.now()}`).toString('base64');
      return NextResponse.json({
        success: true,
        companyId: cred.company_id,
        companyName: company?.name || cred.username.toUpperCase(),
        username: cred.username,
        displayName: cred.username,
        token,
      });
    }

    // ── 3. Fallback: old company_auth table ──
    const { data, error } = await getSupabase()
      .from('company_auth')
      .select('company_id, company_name, password')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'ไม่พบบริษัท หรือยังไม่ได้ตั้งค่าบัญชี' }, { status: 401 });
    }

    if (data.password !== password) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const token = Buffer.from(`${companyId}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      companyId: data.company_id,
      companyName: data.company_name,
      username: '',
      displayName: data.company_name,
      token,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
