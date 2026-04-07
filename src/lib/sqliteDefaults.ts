import Database from "better-sqlite3";

export function applyProductionPragmas(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -2000"); // 2MB — conservative for Pi
}
