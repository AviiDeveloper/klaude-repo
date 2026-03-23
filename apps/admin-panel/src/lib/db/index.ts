import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH
  || path.join(process.cwd(), '..', 'mission-control', 'mission-control.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ensure admin tables exist
    db.exec(ADMIN_SCHEMA);

    // Safe column migrations
    const safeAlter = (sql: string) => { try { db!.exec(sql); } catch { /* exists */ } };
    safeAlter("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT");
    safeAlter("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20");
    safeAlter("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'");
  }
  return db;
}

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

const ADMIN_SCHEMA = `
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

CREATE TABLE IF NOT EXISTS assignment_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('area_match', 'capacity_cap', 'vertical_preference', 'round_robin')),
  config_json TEXT NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT
);

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
  device_type TEXT,
  last_active_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS lead_assignments (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_at TEXT,
  status TEXT DEFAULT 'new',
  visited_at TEXT,
  pitched_at TEXT,
  sold_at TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  notes TEXT,
  commission_amount REAL,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sales_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lead_id TEXT,
  assignment_id TEXT,
  action TEXT NOT NULL,
  notes TEXT,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_user_status ON lead_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
`;
