import Database from 'better-sqlite3';
import path from 'path';

export interface TokenRecord {
  id: number;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  updated_at?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  is_default: number;
  created_at?: string;
}

export interface VideoRecord {
  id: string;
  title: string;
  channel_title: string;
  description: string;
  thumbnail_url: string;
  published_at: string;
  feed_type: 'likes' | 'subscriptions';
  category_id: string | null;
  is_manual_override: number;
  liked_or_ingested_at: string;
}

function getDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'dashboard.db');
}

declare global {
  // eslint-disable-next-line no-var
  var _sqliteDb: Database.Database | undefined;
}

export function getDatabase(): Database.Database {
  if (!global._sqliteDb) {
    const dbPath = getDbPath();
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDatabaseSchema(db);
    global._sqliteDb = db;
  }
  return global._sqliteDb;
}

export function initDatabaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channel_title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      published_at TEXT,
      feed_type TEXT NOT NULL,
      category_id TEXT,
      is_manual_override INTEGER DEFAULT 0,
      liked_or_ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
    CREATE INDEX IF NOT EXISTS idx_videos_feed_type ON videos(feed_type);
    CREATE INDEX IF NOT EXISTS idx_videos_ingested ON videos(liked_or_ingested_at);

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default categories if none exist
  const count = db.prepare('SELECT count(*) as count FROM categories').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO categories (id, name, is_default) VALUES (?, ?, 1)
    `);
    const defaultCategories = [
      { id: 'interview', name: 'Interview' },
      { id: 'entrepreneurship', name: 'Entrepreneurship' },
      { id: 'ai-coding', name: 'AI-Coding' },
      { id: 'movie', name: 'Movie' },
      { id: 'others', name: 'Others' },
    ];
    for (const cat of defaultCategories) {
      insert.run(cat.id, cat.name);
    }
  }
}

// ----------------- Auth Token Helpers -----------------

export function saveTokens(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
}): void {
  const db = getDatabase();
  const existing = getTokens();

  const refreshToken = tokens.refresh_token || existing?.refresh_token || null;
  const expiryDate = tokens.expiry_date ?? existing?.expiry_date ?? null;

  db.prepare(`
    INSERT INTO tokens (id, access_token, refresh_token, expiry_date, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, tokens.refresh_token),
      expiry_date = excluded.expiry_date,
      updated_at = datetime('now')
  `).run(tokens.access_token, refreshToken, expiryDate);
}

export function getTokens(): TokenRecord | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM tokens WHERE id = 1').get() as TokenRecord) || null;
}

export function clearTokens(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tokens WHERE id = 1').run();
}

// ----------------- Category Helpers -----------------

export function getCategories(): CategoryRecord[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories ORDER BY is_default DESC, name ASC').all() as CategoryRecord[];
}

export function addCategory(name: string): CategoryRecord {
  const db = getDatabase();
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`;
  db.prepare(`
    INSERT INTO categories (id, name, is_default)
    VALUES (?, ?, 0)
    ON CONFLICT(name) DO NOTHING
  `).run(id, name.trim());

  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRecord;
}

export function deleteCategory(id: string): boolean {
  const db = getDatabase();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRecord | undefined;
  if (!cat) return false;
  
  // Default categories cannot be deleted
  if (cat.is_default === 1 && cat.id === 'others') {
    return false;
  }

  // Ensure 'others' exists as fallback
  const fallback = db.prepare('SELECT id FROM categories WHERE id = ?').get('others') as { id: string } | undefined;
  const fallbackId = fallback ? fallback.id : 'others';

  // Move videos in this category to fallback before deleting
  db.prepare('UPDATE videos SET category_id = ? WHERE category_id = ?').run(fallbackId, id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return true;
}

// ----------------- Video Helpers -----------------

export function upsertVideo(video: {
  id: string;
  title: string;
  channel_title: string;
  description: string;
  thumbnail_url: string;
  published_at: string;
  feed_type: 'likes' | 'subscriptions';
  category_id?: string | null;
  liked_or_ingested_at?: string;
}): void {
  const db = getDatabase();
  const ingestedAt = video.liked_or_ingested_at || new Date().toISOString();

  // If manual override exists, preserve existing category_id
  const existing = db.prepare('SELECT category_id, is_manual_override FROM videos WHERE id = ?').get(video.id) as {
    category_id: string | null;
    is_manual_override: number;
  } | undefined;

  const categoryId = existing?.is_manual_override ? existing.category_id : (video.category_id ?? existing?.category_id ?? null);
  const isOverride = existing?.is_manual_override ?? 0;

  db.prepare(`
    INSERT INTO videos (
      id, title, channel_title, description, thumbnail_url,
      published_at, feed_type, category_id, is_manual_override, liked_or_ingested_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      channel_title = excluded.channel_title,
      description = excluded.description,
      thumbnail_url = excluded.thumbnail_url,
      feed_type = excluded.feed_type,
      category_id = CASE WHEN videos.is_manual_override = 1 THEN videos.category_id ELSE COALESCE(excluded.category_id, videos.category_id) END,
      liked_or_ingested_at = excluded.liked_or_ingested_at
  `).run(
    video.id,
    video.title,
    video.channel_title,
    video.description,
    video.thumbnail_url,
    video.published_at,
    video.feed_type,
    categoryId,
    isOverride,
    ingestedAt
  );
}

export function updateVideoCategory(videoId: string, categoryId: string, isManual = true): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE videos
    SET category_id = ?, is_manual_override = ?
    WHERE id = ?
  `).run(categoryId, isManual ? 1 : 0, videoId);
  return result.changes > 0;
}

export function getUncategorizedVideos(limit = 50): VideoRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM videos
    WHERE category_id IS NULL OR category_id = ''
    ORDER BY liked_or_ingested_at DESC
    LIMIT ?
  `).all(limit) as VideoRecord[];
}

export function getVideos(options: {
  feedType?: 'likes' | 'subscriptions' | 'all';
  categoryId?: string;
  limit?: number;
  offset?: number;
}): { videos: (VideoRecord & { category_name?: string })[]; total: number } {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.feedType && options.feedType !== 'all') {
    conditions.push('v.feed_type = ?');
    params.push(options.feedType);
  }

  if (options.categoryId && options.categoryId !== 'all') {
    conditions.push('v.category_id = ?');
    params.push(options.categoryId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = db.prepare(`SELECT count(*) as total FROM videos v ${whereClause}`).get(...params) as { total: number };

  const limit = options.limit || 100;
  const offset = options.offset || 0;

  const videos = db.prepare(`
    SELECT v.*, c.name as category_name
    FROM videos v
    LEFT JOIN categories c ON v.category_id = c.id
    ${whereClause}
    ORDER BY v.liked_or_ingested_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (VideoRecord & { category_name?: string })[];

  return { videos, total: countRow.total };
}

// ----------------- Retention Pruning -----------------

export function pruneOldVideos(retentionDays = 15): number {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM videos
    WHERE datetime(liked_or_ingested_at) < datetime('now', '-' || ? || ' days')
  `).run(retentionDays);
  return result.changes;
}

// ----------------- Sync Metadata Helpers -----------------

export function getSyncMetadata(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSyncMetadata(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO sync_metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}
