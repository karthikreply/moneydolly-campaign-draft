import type Database from "better-sqlite3";

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sport_presets (
      id TEXT PRIMARY KEY,
      operator_id TEXT,
      sport_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      dollars_per_player_cents INTEGER NOT NULL,
      min_goal_cents INTEGER,
      max_goal_cents INTEGER,
      default_product_tags TEXT NOT NULL,
      default_surface_order TEXT NOT NULL,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_sport_presets_op_sport
      ON sport_presets(operator_id, sport_key);

    CREATE TABLE IF NOT EXISTS campaign_drafts (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      preset_id TEXT NOT NULL,
      preset_version INTEGER NOT NULL,
      goal_cents INTEGER NOT NULL,
      surface_order TEXT NOT NULL,
      sku_ids_json TEXT NOT NULL,
      note_filter_json TEXT NOT NULL,
      headline TEXT NOT NULL,
      supporting_line TEXT NOT NULL,
      why_draft TEXT NOT NULL,
      why_rules TEXT NOT NULL,
      copy_status TEXT NOT NULL,
      status TEXT NOT NULL,
      campaign_id TEXT,
      goal_at_publish_cents INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      goal_cents INTEGER NOT NULL,
      surface_order TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_offers (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
  `);
}
