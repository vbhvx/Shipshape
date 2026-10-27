import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await db.getSandboxSession(projectId);
    if (!session) {
      return NextResponse.json({
        success: true,
        session: {
          id: `sbx_${projectId}`,
          projectId,
          providerKey: 'isolated_node',
          status: 'stopped',
        },
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
