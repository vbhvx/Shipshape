import { NextRequest, NextResponse } from 'next/server';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await SandboxManager.stopSandbox(projectId);
    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
