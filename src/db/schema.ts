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

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      slug TEXT NOT NULL,
      goal_cents INTEGER NOT NULL,
      is_minor INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_participants_campaign_slug
      ON participants(campaign_id, slug);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      participant_id TEXT,
      supporter_name TEXT NOT NULL,
      supporter_email TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      shipping_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      goal_credit_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_lines (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL,
      product_id TEXT,
      qty INTEGER NOT NULL,
      unit_cents INTEGER NOT NULL,
      group_credit_cents INTEGER NOT NULL
    );
  `);

  const campaignColumns = db
    .prepare(`PRAGMA table_info(campaigns)`)
    .all() as { name: string }[];
  const names = new Set(campaignColumns.map((column) => column.name));
  if (!names.has("slug")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN slug TEXT`);
  }
  if (!names.has("headline")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN headline TEXT`);
  }
  if (!names.has("supporting_line")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN supporting_line TEXT`);
  }
  if (!names.has("theme_key")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN theme_key TEXT`);
  }
  if (!names.has("org_display_name")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN org_display_name TEXT`);
  }
  if (!names.has("ends_at")) {
    db.exec(`ALTER TABLE campaigns ADD COLUMN ends_at TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_campaigns_slug ON campaigns(slug)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS template_registry (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
