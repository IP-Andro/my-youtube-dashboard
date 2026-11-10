# Technical Architecture: YouTube Topic Dashboard

## 1. System Overview

The **YouTube Topic Dashboard** is a local-first, distraction-free web application designed to curate and categorize a user's YouTube activity into customized topic buckets (such as `Interview`, `Entrepreneurship`, `AI-Coding`, `Movie`, `Others`). 

It ingests content from two distinct sources:
1. **Liked Videos**: The user's historical saved backlog.
2. **Subscriptions Feed**: Recent uploads from subscribed channels (within the last 15 days).

Videos are classified into topics using an LLM (Gemini 2.0 Flash), cached in a local SQLite database to prevent repeated API calls, automatically pruned after 15 days, and presented in a responsive tabbed UI that opens videos directly in a new tab on YouTube.com.

---

## 2. Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER                                     |
|                                                                                       |
|  [ Dashboard UI - React / Tailwind CSS ]                                              |
|  * Feed Toggle: [ Liked Videos | Subscriptions | All ]                                |
|  * Category Tabs: [ All (48) ] [ AI-Coding (18) ] [ Interview (12) ] ... [ + New ]    |
|  * On-Demand "Sync Now" button with relative "Last synced: 10 mins ago" status        |
|  * Video Grid: Cards with direct YouTube launch (target="_blank") & override dropdown |
+------------------------------------------+--------------------------------------------+
                                           | Fetch / REST API
                                           v
+---------------------------------------------------------------------------------------+
|                         SERVER LAYER (Next.js Route Handlers)                         |
|                                                                                       |
|  * /api/auth/login & /api/auth/callback (Google OAuth 2.0 Flow)                       |
|  * /api/sync (Sync Orchestrator: Ingestion -> LLM -> Retention Pruning)               |
|  * /api/status (Connection state & last_synced_at timestamp)                          |
|  * /api/videos & /api/videos/override (Feed queries & manual category reassignment)  |
|  * /api/categories (Dynamic category creation & deletion)                             |
+---------------------+-------------------------------+---------------------------------+
                      |                               |
       External APIs  |                               | Database Operations
                      v                               v
+-----------------------------------+   +-----------------------------------------------+
|         EXTERNAL SERVICES         |   |                 LOCAL STORAGE                 |
|                                   |   |                                               |
|  1. Google OAuth 2.0              |   |  SQLite Database (dashboard.db)               |
|     * Read-only YouTube scopes    |   |  * tokens (access_token, refresh_token)       |
|                                   |   |  * categories (id, name, is_default)          |
|  2. YouTube Data API v3           |   |  * videos (metadata, category_id, override)   |
|     * videos.list(myRating='like')|   |  * sync_metadata (last_synced_at)             |
|     * subscriptions.list          |   |                                               |
|     * playlistItems.list          |   |  15-Day Retention Engine:                     |
|                                   |   |  Auto-purges records older than 15 days       |
|  3. Gemini 2.0 Flash API          |   +-----------------------------------------------+
|     * Batch topic classification  |
+-----------------------------------+
```

---

## 3. Core Components

### 3.1 Data Ingestion Pipeline (`src/lib/youtube.ts`)
* **OAuth 2.0 Authentication**: Requests `https://www.googleapis.com/auth/youtube.readonly`. Automatically uses the stored refresh token when the access token expires.
* **Liked Videos Ingestion**: Calls `youtube.videos.list(part='snippet,contentDetails', myRating='like', maxResults=50)`.
* **Subscribed Uploads Ingestion**:
  1. Calls `youtube.subscriptions.list(mine=true)` to retrieve subscribed channels.
  2. Resolves channel uploads playlists (converting `UC...` channel IDs to `UU...` playlist IDs to save API quota).
  3. Fetches recent items via `playlistItems.list`, filtering out any uploads older than 15 days.

### 3.2 Categorization Engine (`src/lib/categorizer.ts`)
* **Model**: Google Gemini 2.0 Flash via `@google/genai`.
* **Dynamic Active Categories**: The prompt is built dynamically using the active categories from SQLite (`Interview`, `Entrepreneurship`, `AI-Coding`, `Movie`, `Others`, plus custom user categories).
* **Batch Classification**: Evaluates up to 20 unclassified videos in a single structured prompt, minimizing latency and LLM token usage.
* **Local Caching**: Classifications are persisted directly to the `videos` table (`category_id`). Videos are evaluated only once.
* **Manual Override**: If a user reassigns a category via the card dropdown, `is_manual_override = 1` is saved. Subsequent sync operations will never overwrite user-assigned categories.
* **Graceful Degradation**: If `GEMINI_API_KEY` is not provided or quota fails, unclassified videos safely fallback to `others` without breaking application flows.

### 3.3 Data Model & Storage (`src/lib/db.ts`)
SQLite is used via `better-sqlite3` with WAL mode and foreign key constraints enabled.

#### Database Tables
1. **`tokens`**:
   * `id INTEGER PRIMARY KEY CHECK (id = 1)`
   * `access_token TEXT NOT NULL`
   * `refresh_token TEXT`
   * `expiry_date INTEGER`
   * `updated_at TEXT`
2. **`categories`**:
   * `id TEXT PRIMARY KEY` (slugified identifier, e.g., `ai-coding`)
   * `name TEXT NOT NULL UNIQUE` (display name, e.g., `AI-Coding`)
   * `is_default INTEGER DEFAULT 0` (1 for defaults: `Interview`, `Entrepreneurship`, `AI-Coding`, `Movie`, `Others`)
   * `created_at TEXT`
3. **`videos`**:
   * `id TEXT PRIMARY KEY` (YouTube video ID)
   * `title TEXT NOT NULL`
   * `channel_title TEXT NOT NULL`
   * `description TEXT`
   * `thumbnail_url TEXT`
   * `published_at TEXT`
   * `feed_type TEXT NOT NULL` (`likes` | `subscriptions`)
   * `category_id TEXT REFERENCES categories(id) ON DELETE SET NULL`
   * `is_manual_override INTEGER DEFAULT 0`
   * `liked_or_ingested_at TEXT NOT NULL`
4. **`sync_metadata`**:
   * `key TEXT PRIMARY KEY` (e.g., `last_synced_at`)
   * `value TEXT NOT NULL`

---

## 4. Data Retention & Cleanup Policy

To keep the database lean and relevant:
* During every sync cycle (`POST /api/sync`), the retention pruning query runs:
  ```sql
  DELETE FROM videos 
  WHERE datetime(liked_or_ingested_at) < datetime('now', '-15 days');
  ```
* Any video whose like timestamp or subscription publication timestamp is older than 15 days is permanently purged from SQLite.

---

## 5. Security & Secret Management

* All secret keys (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`) remain strictly on the server in `.env.local`.
* Browser clients only communicate with internal Next.js Route Handlers; client secrets and Gemini API keys are never leaked to client bundles.

---

## 6. Frontend Interface (`src/app/page.tsx` & `src/components/`)

* **`Header.tsx`**:
  * Feed source switcher (`Liked Videos`, `Subscriptions`, `All Feeds`).
  * On-demand **"Sync Now"** button with spinning state and feedback message.
  * Relative timestamp: `"Last synced 12 minutes ago"`.
  * Google OAuth connection status with Connect/Logout actions.
* **`CategoryTabs.tsx`**:
  * Interactive category tabs with real-time video counts (`All (42)`, `AI-Coding (15)`).
  * Dynamic category creation inline.
  * Category deletion (automatically reassigns orphan videos to `others`).
* **`VideoCard.tsx`**:
  * Direct launch link (`target="_blank"`, `rel="noopener noreferrer"`) opening `https://www.youtube.com/watch?v={id}` in a new tab.
  * Metadata display: Channel name, published date, feed type badge.
  * Category override dropdown with instant feedback indicator.

---

## 7. Inspection and CLI Tooling

A built-in inspection script is provided in the repository:
```bash
npm run db:inspect
```
Prints the sync status, active category distribution, and the 15 most recently ingested videos directly to the terminal.
