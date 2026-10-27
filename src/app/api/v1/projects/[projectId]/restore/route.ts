import { NextRequest, NextResponse } from 'next/server';
import { restoreVersion } from '@/modules/versioning/diff-engine';
import { RestoreVersionSchema } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const parsed = RestoreVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid restore request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const newVersion = await restoreVersion(projectId, parsed.data.versionId, parsed.data.reason);

    return NextResponse.json({
      success: true,
      restoredVersion: newVersion,
      message: `Successfully restored version to new snapshot v${newVersion.versionNumber}`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
