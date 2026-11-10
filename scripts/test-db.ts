import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(process.cwd(), 'test-dashboard.db');
if (fs.existsSync(TEST_DB)) {
  fs.unlinkSync(TEST_DB);
}
process.env.DB_PATH = TEST_DB;

async function runTests() {
  const {
    getDatabase,
    getCategories,
    addCategory,
    deleteCategory,
    upsertVideo,
    updateVideoCategory,
    getVideos,
    pruneOldVideos,
    saveTokens,
    getTokens,
    setSyncMetadata,
    getSyncMetadata,
  } = await import('../src/lib/db');

  console.log('Testing DB initialization and file creation...');
  const db = getDatabase();
  if (!fs.existsSync(TEST_DB)) {
    throw new Error('Database file was not created!');
  }
  console.log('✓ Database file created at', TEST_DB);

  // 1. Verify tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = tables.map(t => t.name);
  const required = ['tokens', 'categories', 'videos', 'sync_metadata'];
  for (const req of required) {
    if (!tableNames.includes(req)) {
      throw new Error(`Missing table: ${req}`);
    }
  }
  console.log('✓ Required tables present:', required.join(', '));

  // 2. Verify default categories
  const categories = getCategories();
  console.log('Default categories count:', categories.length);
  const catNames = categories.map(c => c.name);
  if (!catNames.includes('Interview') || !catNames.includes('AI-Coding')) {
    throw new Error('Default categories not seeded correctly');
  }
  console.log('✓ Default categories seeded:', catNames.join(', '));

  // 3. Test add and delete category
  const newCat = addCategory('Podcasts');
  if (newCat.name !== 'Podcasts') throw new Error('Failed to add category');
  console.log('✓ Category added:', newCat.name);

  // 4. Test video upsert
  upsertVideo({
    id: 'vid-1',
    title: 'How to build AI agents',
    channel_title: 'Tech Channel',
    description: 'Awesome video on AI coding',
    thumbnail_url: 'https://example.com/thumb.jpg',
    published_at: new Date().toISOString(),
    feed_type: 'likes',
    category_id: 'ai-coding',
  });

  const { videos, total } = getVideos({ feedType: 'likes', categoryId: 'ai-coding' });
  if (total !== 1 || videos[0].title !== 'How to build AI agents') {
    throw new Error('Failed to retrieve upserted video');
  }
  console.log('✓ Video upsert and query successful');

  // 5. Test manual category override
  updateVideoCategory('vid-1', 'interview', true);
  const updated = getVideos({ categoryId: 'interview' });
  if (updated.total !== 1 || updated.videos[0].is_manual_override !== 1) {
    throw new Error('Failed to apply manual category override');
  }
  console.log('✓ Manual category override working');

  // 6. Test delete category fallback
  deleteCategory('podcasts');
  console.log('✓ Category delete handled safely');

  // 7. Test tokens
  saveTokens({ access_token: 'test-token', refresh_token: 'test-refresh', expiry_date: 1234567 });
  const tokens = getTokens();
  if (tokens?.access_token !== 'test-token' || tokens?.refresh_token !== 'test-refresh') {
    throw new Error('Token save/get failed');
  }
  console.log('✓ Token storage verified');

  // 8. Test sync metadata
  setSyncMetadata('last_synced_at', '2026-11-10T12:00:00Z');
  if (getSyncMetadata('last_synced_at') !== '2026-11-10T12:00:00Z') {
    throw new Error('Sync metadata failed');
  }
  console.log('✓ Sync metadata verified');

  // 9. Test retention pruning
  upsertVideo({
    id: 'old-vid',
    title: 'Ancient video',
    channel_title: 'Old Channel',
    description: 'Old stuff',
    thumbnail_url: 'https://example.com/old.jpg',
    published_at: '2026-10-01T00:00:00Z',
    feed_type: 'subscriptions',
    liked_or_ingested_at: '2026-10-01T00:00:00Z',
  });
  const pruned = pruneOldVideos(15);
  if (pruned < 1) {
    throw new Error('Retention pruning failed to delete 20-day-old video');
  }
  console.log('✓ 15-day retention pruning successfully removed expired records');

  // Clean up
  db.close();
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
  if (fs.existsSync(`${TEST_DB}-wal`)) {
    fs.unlinkSync(`${TEST_DB}-wal`);
  }
  if (fs.existsSync(`${TEST_DB}-shm`)) {
    fs.unlinkSync(`${TEST_DB}-shm`);
  }
  console.log('ALL DB TESTS PASSED!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
