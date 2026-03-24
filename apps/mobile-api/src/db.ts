import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DB_PATH = process.env.DATABASE_PATH
  ?? join(process.cwd(), '..', 'mission-control', 'mission-control.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF'); // Relaxed for cross-app compatibility
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = getDb();

  // Ensure sales tables exist (may already from web app)
  d.exec(`
    CREATE TABLE IF NOT EXISTS sales_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL,
      email TEXT, phone TEXT, area_postcode TEXT, commission_rate REAL DEFAULT 0.10,
      active INTEGER DEFAULT 1, api_token TEXT, push_token TEXT, device_type TEXT,
      last_active_at TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS lead_assignments (
      id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, user_id TEXT NOT NULL,
      assigned_at TEXT, status TEXT DEFAULT 'new',
      visited_at TEXT, pitched_at TEXT, sold_at TEXT, rejected_at TEXT, rejection_reason TEXT,
      notes TEXT, commission_amount REAL, location_lat REAL, location_lng REAL,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sales_activity_log (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lead_id TEXT, assignment_id TEXT,
      action TEXT NOT NULL, notes TEXT, location_lat REAL, location_lng REAL,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS demo_links (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
      assignment_id TEXT NOT NULL, user_id TEXT NOT NULL, lead_id TEXT NOT NULL,
      business_name TEXT NOT NULL, demo_domain TEXT,
      status TEXT DEFAULT 'active', views INTEGER DEFAULT 0,
      last_viewed_at TEXT, customer_name TEXT, customer_phone TEXT,
      customer_email TEXT, customer_message TEXT, interested_at TEXT,
      converted_at TEXT, expires_at TEXT, created_at TEXT
    );
  `);

  // Mobile-specific tables
  d.exec(`
    CREATE TABLE IF NOT EXISTS visit_sessions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER,
      start_lat REAL, start_lng REAL,
      end_lat REAL, end_lng REAL,
      verified INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lead_photos (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      category TEXT DEFAULT 'storefront',
      lat REAL, lng REAL,
      captured_at TEXT NOT NULL,
      uploaded_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      user_id TEXT PRIMARY KEY,
      expo_token TEXT NOT NULL,
      platform TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_journal (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_visit_sessions_user ON visit_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_visit_sessions_assignment ON visit_sessions(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_lead_photos_assignment ON lead_photos(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_sync_journal_user ON sync_journal(user_id, synced_at);
  `);
}

// Query helpers
export function queryAll<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return getDb().prepare(sql).run(...params);
}
