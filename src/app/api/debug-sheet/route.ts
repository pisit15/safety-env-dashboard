import { NextResponse } from 'next/server';
import { getCompanyForYearWithDb } from '@/lib/company-settings';
import { DEFAULT_YEAR } from '@/lib/companies';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('id') || '';
  const planType = (searchParams.get('plan') || 'safety') as 'safety' | 'environment';
  const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

  const company = await getCompanyForYearWithDb(companyId, year);
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const sheetName = planType === 'safety' ? company.safetySheet : company.enviSheet;
  const results: Record<string, unknown> = {
    company: {
      id: company.id,
      name: company.name,
      sheetId: company.sheetId,
      safetySheet: company.safetySheet,
      enviSheet: company.enviSheet,
    },
    resolvedSheetName: sheetName,
  };

  // Try xlsx download
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const { google } = await import('googleapis');
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      results.serviceAccountEmail = parsed.client_email;

      const auth = new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();

      if (tokenResponse.token) {
        results.tokenObtained = true;

        // Try downloading
        const url = `https://www.googleapis.com/drive/v3/files/${company.sheetId}?alt=media`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${tokenResponse.token}` },
          cache: 'no-store',
        });

        results.driveStatus = response.status;
        results.driveStatusText = response.statusText;

        if (!response.ok) {
          const text = await response.text();
          results.driveError = text.substring(0, 500);
        } else {
          const buf = await response.arrayBuffer();
          results.fileSize = buf.byteLength;

          // Try parsing
          const ExcelJS = (await import('exceljs')).default;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buf as any);

          results.worksheetNames = workbook.worksheets.map(ws => ws.name);

          const ws = workbook.getWorksheet(sheetName);
          if (ws) {
            results.sheetFound = true;
            results.rowCount = ws.rowCount;
            // Show first 3 rows for debugging
            const sampleRows: string[][] = [];
            ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber <= 10) {
                const cells: string[] = [];
                for (let col = 1; col <= 10; col++) {
                  const cell = row.getCell(col);
                  cells.push(String(cell.value || '').substring(0, 30));
                }
                sampleRows.push(cells);
              }
            });
            results.sampleRows = sampleRows;
          } else {
            results.sheetFound = false;
            // Try partial match
            const partial = workbook.worksheets.find(ws2 =>
              ws2.name.toLowerCase().includes(sheetName.toLowerCase().split(' ')[0])
            );
            results.partialMatch = partial?.name || null;
          }
        }
      }
    } catch (err: unknown) {
      results.xlsxError = String(err);
    }
  } else {
    results.noServiceAccount = true;
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
