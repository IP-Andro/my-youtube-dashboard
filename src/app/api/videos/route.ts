import { NextRequest, NextResponse } from 'next/server';
import { getVideos } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedType = (searchParams.get('feedType') as 'likes' | 'subscriptions' | 'all') || 'all';
    const categoryId = searchParams.get('categoryId') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { videos, total } = getVideos({ feedType, categoryId, limit, offset });

    return NextResponse.json({
      videos,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
