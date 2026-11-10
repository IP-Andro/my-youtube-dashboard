import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'dashboard.db');

if (!fs.existsSync(dbPath)) {
  console.log('\n❌ No database file found yet at:', dbPath);
  console.log('Run the app and click "Sync Now" to create and populate the database.\n');
  process.exit(0);
}

const db = new Database(dbPath);

console.log('\n========================================');
console.log('       YOUTUBE DASHBOARD DATABASE       ');
console.log('========================================\n');

// 1. Sync Metadata
const metadata = db.prepare('SELECT * FROM sync_metadata').all() as { key: string; value: string }[];
console.log('📌 SYNC METADATA:');
if (metadata.length === 0) {
  console.log('  (No sync metadata yet)');
} else {
  for (const row of metadata) {
    console.log(`  ${row.key}: ${row.value}`);
  }
}
console.log('');

// 2. Categories Summary
const categories = db.prepare(`
  SELECT c.id, c.name, c.is_default, COUNT(v.id) as video_count
  FROM categories c
  LEFT JOIN videos v ON c.id = v.category_id
  GROUP BY c.id
  ORDER BY video_count DESC
`).all() as { id: string; name: string; is_default: number; video_count: number }[];

console.log('📁 CATEGORIES:');
console.table(categories);

// 3. Videos Summary
const totalRow = db.prepare('SELECT COUNT(*) as total FROM videos').get() as { total: number };
console.log(`🎬 STORED VIDEOS: Total ${totalRow.total}`);

if (totalRow.total > 0) {
  const recentVideos = db.prepare(`
    SELECT 
      v.id,
      SUBSTR(v.title, 1, 35) as title,
      SUBSTR(v.channel_title, 1, 18) as channel,
      v.feed_type as feed,
      v.category_id as category,
      CASE WHEN v.is_manual_override = 1 THEN 'Manual' ELSE 'AI' END as tagged_by,
      SUBSTR(v.liked_or_ingested_at, 1, 10) as ingested
    FROM videos v
    ORDER BY v.liked_or_ingested_at DESC
    LIMIT 15
  `).all();

  console.log('\nShowing 15 Most Recent Videos:');
  console.table(recentVideos);
} else {
  console.log('  (No videos stored yet. Start the app and click "Sync Now" to populate.)');
}

console.log('');
db.close();
