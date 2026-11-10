import { NextRequest, NextResponse } from 'next/server';
import { getCategories, addCategory, deleteCategory, getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const categories = getCategories();
    const db = getDatabase();

    // Compute counts for each category
    const counts = db.prepare(`
      SELECT category_id, count(*) as count
      FROM videos
      GROUP BY category_id
    `).all() as { category_id: string | null; count: number }[];

    const countMap: Record<string, number> = {};
    let totalVideos = 0;
    for (const r of counts) {
      if (r.category_id) {
        countMap[r.category_id] = r.count;
      }
      totalVideos += r.count;
    }

    const categoriesWithCount = categories.map((c) => ({
      ...c,
      video_count: countMap[c.id] || 0,
    }));

    return NextResponse.json({
      categories: categoriesWithCount,
      total_videos: totalVideos,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch categories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Valid category name is required' }, { status: 400 });
    }

    const category = addCategory(name);
    return NextResponse.json({ success: true, category });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create category';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    const deleted = deleteCategory(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Cannot delete default category or category not found' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete category';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
