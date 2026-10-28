import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exportProjectArchive } from '@/modules/export/export-service';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    const project = await getOwnedProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId') || undefined;

    if (versionId) {
      const version = await db.getVersion(versionId);

      if (!version || version.projectId !== projectId) {
        return NextResponse.json(
          { success: false, error: 'Version not found' },
          { status: 404 }
        );
      }
    }

    const exportResult = await exportProjectArchive(projectId, versionId);

    return new NextResponse(new Uint8Array(exportResult.zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${exportResult.fileName}"`,
        'Content-Length': exportResult.totalBytes.toString(),
        'X-Export-Files-Count': exportResult.filesIncluded.toString(),
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to export project archive:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to export project archive' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return GET(req, { params });
}
