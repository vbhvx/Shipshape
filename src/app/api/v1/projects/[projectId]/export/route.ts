import { NextRequest, NextResponse } from 'next/server';
import { exportProjectArchive } from '@/modules/export/export-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId') || undefined;

    const exportResult = await exportProjectArchive(projectId, versionId);

    // Return binary zip response
    return new NextResponse(new Uint8Array(exportResult.zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${exportResult.fileName}"`,
        'Content-Length': exportResult.totalBytes.toString(),
        'X-Export-Files-Count': exportResult.filesIncluded.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // Support POST as well
  return GET(req, { params });
}
