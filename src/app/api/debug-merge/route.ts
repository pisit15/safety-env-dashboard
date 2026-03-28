import { NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/companies';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

async function getServiceAccountToken(): Promise<string> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('No service account credentials');
  const { google } = await import('googleapis');
  const parsed = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Failed to get access token');
  return tokenResponse.token;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company') || 'ea-kabin';

  const company = getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const token = await getServiceAccountToken();
  const url = `https://www.googleapis.com/drive/v3/files/${company.sheetId}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-store',
  });

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as any);

  const worksheet = workbook.worksheets.find(ws =>
    ws.name.toLowerCase().includes('safety')
  ) || workbook.worksheets[0];

  // Check merges from worksheet model
  const modelMerges = (worksheet as any).model?.merges || [];

  // Check column E (budget) cells for merge info
  const budgetCells: any[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 200) return;
    const cellA = row.getCell(1); // Column A
    const cellE = row.getCell(5); // Column E (budget)
    const cellF = row.getCell(6); // Column F (Plan/Actual)

    const noVal = String(cellA.value || '').trim();
    const budgetVal = String(cellE.value || '').trim();
    const planActual = String(cellF.value || '').trim();

    if (noVal.includes('.') && planActual.toLowerCase().includes('plan') && budgetVal && budgetVal !== '0') {
      const master = (cellE as any).master;
      budgetCells.push({
        row: rowNumber,
        no: noVal,
        budget: budgetVal,
        cellAddress: cellE.address,
        isMerged: (cellE as any).isMerged || false,
        masterAddress: master?.address || 'none',
        masterRow: master?.row || 'none',
        masterCol: master?.col || 'none',
        cellRow: cellE.row,
        cellCol: cellE.col,
        sameAsMaster: master ? (master.row === cellE.row && master.col === cellE.col) : 'no-master',
        type: (cellE as any).type,
        model: JSON.stringify((cellE as any).model || {}),
      });
    }
  });

  return NextResponse.json({
    sheetName: worksheet.name,
    modelMergesCount: modelMerges.length,
    modelMergesFirst10: modelMerges.slice(0, 10),
    budgetCellsWithValues: budgetCells,
  });
}
