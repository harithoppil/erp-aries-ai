import { NextRequest, NextResponse } from 'next/server';
import { getBackupFilePath } from '@/app/dashboard/erp/backup/actions';
import { readFile } from 'fs/promises';

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('file');
  if (!filename) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  const filepath = await getBackupFilePath(filename);
  if (!filepath) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  try {
    const data = await readFile(filepath);
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read backup file' }, { status: 500 });
  }
}
