import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "./schema";

let singleton: Database.Database | null = null;

export function getDbPath(): string {
  if (process.env.DRAFT_DB_PATH) return process.env.DRAFT_DB_PATH;
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "campaign-draft.sqlite");
}

export function openDb(dbPath?: string): Database.Database {
  const file = dbPath ?? getDbPath();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  if (!singleton) singleton = openDb();
  return singleton;
}

export function resetDbForTests(dbPath: string): Database.Database {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  singleton = openDb(dbPath);
  return singleton;
}
