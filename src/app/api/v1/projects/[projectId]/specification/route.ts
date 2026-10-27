import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const spec = await db.getSpecification(projectId);
    if (!spec) {
      return NextResponse.json({ success: false, error: 'Specification not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, specification: spec });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const spec = await db.getSpecification(projectId);
    if (!spec) {
      return NextResponse.json({ success: false, error: 'Specification not found' }, { status: 404 });
    }

    const updates = await req.json();
    const updatedSpec = {
      ...spec,
      ...updates,
      projectId,
      versionNumber: spec.versionNumber + 1,
    };

    await db.saveSpecification(updatedSpec);
    return NextResponse.json({ success: true, specification: updatedSpec });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
