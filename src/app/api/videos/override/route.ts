import { NextRequest, NextResponse } from 'next/server';
import { updateVideoCategory } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, categoryId } = body;

    if (!videoId || !categoryId) {
      return NextResponse.json({ error: 'videoId and categoryId are required' }, { status: 400 });
    }

    const updated = updateVideoCategory(videoId, categoryId, true);
    if (!updated) {
      return NextResponse.json({ error: 'Video not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, videoId, categoryId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update category override';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
