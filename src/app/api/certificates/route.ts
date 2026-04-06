import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, getSupabase } from '@/lib/supabase';

// GET - Fetch certificates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const employeeId = searchParams.get('employeeId');
  const empCode = searchParams.get('empCode');

  const supabase = getSupabase();
  let query = supabase
    .from('employee_certificates')
    .select('*')
    .order('expiry_date', { ascending: true, nullsFirst: false });

  if (companyId) query = query.eq('company_id', companyId);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (empCode) query = query.eq('emp_code', empCode);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Add certificate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, employee_id, emp_code, certificate_name, issued_date, expiry_date, no_expiry, certificate_number, issuer, image_url, notes } = body;

    if (!company_id || !certificate_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('employee_certificates')
      .insert({
        company_id,
        employee_id: employee_id || null,
        emp_code: emp_code || '',
        certificate_name,
        issued_date: issued_date || null,
        expiry_date: no_expiry ? null : (expiry_date || null),
        no_expiry: no_expiry || false,
        certificate_number: certificate_number || '',
        issuer: issuer || '',
        image_url: image_url || '',
        notes: notes || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update certificate
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing certificate id' }, { status: 400 });
    }

    // If no_expiry is true, clear expiry_date
    if (updates.no_expiry) {
      updates.expiry_date = null;
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('employee_certificates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove certificate
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get image URL to delete from storage
  const { data: cert } = await supabase
    .from('employee_certificates')
    .select('image_url')
    .eq('id', id)
    .single();

  // Delete the certificate record
  const { error } = await supabase
    .from('employee_certificates')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Try to delete associated image from storage
  if (cert?.image_url) {
    try {
      const url = cert.image_url as string;
      const match = url.match(/\/certificates\/(.+)$/);
      if (match) {
        await supabase.storage.from('certificates').remove([match[1]]);
      }
    } catch { /* ignore storage deletion errors */ }
  }

  return NextResponse.json({ success: true });
}
