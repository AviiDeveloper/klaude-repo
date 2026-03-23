import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Share the same database as mission-control
const DB_PATH = process.env.DATABASE_PATH
  || path.join(process.cwd(), '..', 'mission-control', 'mission-control.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure parent directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ensure sales-specific tables exist (safe to run multiple times)
    db.exec(SALES_SCHEMA);

    // Safe migrations — ALTER TABLE ADD COLUMN is idempotent if we catch errors
    const safeAlter = (sql: string) => { try { db!.exec(sql); } catch { /* column already exists */ } };
    safeAlter("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT");
    safeAlter("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20");
    safeAlter("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'");

    // Follow-up reminders
    safeAlter("ALTER TABLE lead_assignments ADD COLUMN follow_up_at TEXT");
    safeAlter("ALTER TABLE lead_assignments ADD COLUMN follow_up_note TEXT");

    // Contact person tracking
    safeAlter("ALTER TABLE lead_assignments ADD COLUMN contact_name TEXT");
    safeAlter("ALTER TABLE lead_assignments ADD COLUMN contact_role TEXT");

    // Unique index: one active assignment per lead (rejected leads can be reassigned)
    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_unique_active ON lead_assignments(lead_id) WHERE status NOT IN ('rejected')");
    } catch { /* index already exists or partial index not supported — use trigger fallback */ }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

export function queryAll<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

// ---------------------------------------------------------------------------
// Sales-specific schema (CREATE IF NOT EXISTS — safe to re-run)
// ---------------------------------------------------------------------------

const SALES_SCHEMA = `
-- Salesman accounts
CREATE TABLE IF NOT EXISTS sales_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  area_postcode TEXT,
  commission_rate REAL DEFAULT 0.10,
  active INTEGER DEFAULT 1,
  api_token TEXT,
  push_token TEXT,
  device_type TEXT CHECK (device_type IN ('web', 'ios', 'android')),
  last_active_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Lead assignments (which salesman owns which lead)
CREATE TABLE IF NOT EXISTS lead_assignments (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES sales_users(id) ON DELETE CASCADE,
  assigned_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'visited', 'pitched', 'sold', 'rejected')),
  visited_at TEXT,
  pitched_at TEXT,
  sold_at TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  notes TEXT,
  commission_amount REAL,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Activity audit trail
CREATE TABLE IF NOT EXISTS sales_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES sales_users(id) ON DELETE CASCADE,
  lead_id TEXT,
  assignment_id TEXT REFERENCES lead_assignments(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  notes TEXT,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lead_assignments_user_status ON lead_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_user ON sales_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activity_lead ON sales_activity_log(lead_id, created_at DESC);

-- Admin accounts (separate from salespeople)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'viewer')),
  active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Assignment rules (configurable via admin panel)
CREATE TABLE IF NOT EXISTS assignment_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('area_match', 'capacity_cap', 'vertical_preference', 'round_robin')),
  config_json TEXT NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT
);
`;
