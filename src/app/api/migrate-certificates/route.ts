import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST() {
  try {
    const supabase = getSupabase();

    // Try creating the table using RPC or direct SQL
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS employee_certificates (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          company_id text NOT NULL,
          employee_id uuid REFERENCES company_employees(id) ON DELETE CASCADE,
          emp_code text,
          certificate_name text NOT NULL,
          issued_date date,
          expiry_date date,
          no_expiry boolean DEFAULT false,
          certificate_number text,
          issuer text,
          image_url text,
          notes text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_emp_cert_company ON employee_certificates(company_id);
        CREATE INDEX IF NOT EXISTS idx_emp_cert_employee ON employee_certificates(employee_id);
        CREATE INDEX IF NOT EXISTS idx_emp_cert_expiry ON employee_certificates(expiry_date);
      `
    });

    if (rpcError) {
      // Return SQL for manual execution
      return NextResponse.json({
        success: false,
        message: 'Please run this SQL manually in Supabase SQL Editor',
        sql: `
CREATE TABLE IF NOT EXISTS employee_certificates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id text NOT NULL,
  employee_id uuid REFERENCES company_employees(id) ON DELETE CASCADE,
  emp_code text,
  certificate_name text NOT NULL,
  issued_date date,
  expiry_date date,
  no_expiry boolean DEFAULT false,
  certificate_number text,
  issuer text,
  image_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_cert_company ON employee_certificates(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_cert_employee ON employee_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_cert_expiry ON employee_certificates(expiry_date);

-- Storage bucket for certificate images
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');

-- Allow authenticated uploads
CREATE POLICY "Allow uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificates');

-- Allow updates
CREATE POLICY "Allow updates" ON storage.objects FOR UPDATE USING (bucket_id = 'certificates');

-- Allow deletes
CREATE POLICY "Allow deletes" ON storage.objects FOR DELETE USING (bucket_id = 'certificates');

-- RLS for employee_certificates
ALTER TABLE employee_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to employee_certificates" ON employee_certificates FOR ALL USING (true) WITH CHECK (true);
        `
      });
    }

    return NextResponse.json({ success: true, message: 'Table created successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
