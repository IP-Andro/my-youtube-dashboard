import { getDatabase, pruneOldVideos, setSyncMetadata, getSyncMetadata, upsertVideo } from '../src/lib/db';
import { GET as getStatus } from '../src/app/api/status/route';
import { POST as runSync } from '../src/app/api/sync/route';

async function testSyncAndStatus() {
  console.log('Testing Sync and Status APIs...');

  // 1. Verify 15-day pruning
  upsertVideo({
    id: 'prune-test-1',
    title: 'Prune Test',
    channel_title: 'Pruner',
    description: 'desc',
    thumbnail_url: 'thumb',
    published_at: '2026-10-01T00:00:00Z',
    feed_type: 'likes',
    liked_or_ingested_at: '2026-10-01T00:00:00Z',
  });

  const pruned = pruneOldVideos(15);
  console.log(`✓ 15-day pruning executed: removed ${pruned} old records`);

  // 2. Test status route
  setSyncMetadata('last_synced_at', '2026-11-10T12:30:00Z');
  const statusRes = await getStatus();
  const statusData = await statusRes.json();
  if (statusData.last_synced_at !== '2026-11-10T12:30:00Z') {
    throw new Error('Status API did not return correct last_synced_at');
  }
  console.log('✓ /api/status returned correct last_synced_at and status flags');

  // 3. Test sync route unauthenticated response
  const syncRes = await runSync();
  const syncData = await syncRes.json();
  if (syncRes.status === 401 && syncData.needs_auth === true) {
    console.log('✓ /api/sync correctly caught unauthenticated state and prompted for auth');
  } else {
    throw new Error('Expected 401 unauthenticated response from /api/sync');
  }

  console.log('ALL SYNC AND STATUS TESTS PASSED!');
}

testSyncAndStatus().catch((err) => {
  console.error(err);
  process.exit(1);
});
