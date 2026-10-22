import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { generateGuardedCopy } from "@/lib/copyGenerator";
import { PROTOTYPE_TODAY } from "@/lib/hydrateIntent";
import { runDraftRules } from "./draft-rules-engine";
import { hydrateOmniBrief } from "./omni-hydrate";
import {
  createPresetStore,
  listSportPresets,
  resolveSportPreset,
  upsertSportPreset,
  type PresetStore,
  type PresetUpsertInput,
} from "./sport-presets";
import { STUB_CATALOG } from "./stub-catalog";
import { isThemeKey, resolveThemePack } from "./theme-packs";
import type {
  CampaignBrief,
  CampaignDraft,
  CatalogSku,
  NoteFilterResult,
  PublishedCampaign,
  SportPreset,
  SurfaceOrder,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeBrief(raw: CampaignBrief): CampaignBrief {
  const themeKey = isThemeKey(raw.themeKey) ? raw.themeKey : "classic_season";
  return { ...raw, themeKey };
}

function rowToDraft(row: Record<string, unknown>): CampaignDraft {
  const brief = normalizeBrief(JSON.parse(row.brief_json as string) as CampaignBrief);
  return {
    id: row.id as string,
    operatorId: row.operator_id as string,
    orgId: row.org_id as string,
    createdBy: row.created_by as string,
    brief,
    presetId: row.preset_id as string,
    presetVersion: row.preset_version as number,
    goalCents: row.goal_cents as number,
    surfaceOrder: row.surface_order as SurfaceOrder,
    skuIds: JSON.parse(row.sku_ids_json as string) as string[],
    noteFilter: JSON.parse(row.note_filter_json as string) as NoteFilterResult,
    headline: row.headline as string,
    supportingLine: row.supporting_line as string,
    whyDraft: row.why_draft as string,
    whyRules: row.why_rules as string,
    copyStatus: row.copy_status as CampaignDraft["copyStatus"],
    status: row.status as CampaignDraft["status"],
    campaignId: (row.campaign_id as string | null) ?? null,
    goalAtPublishCents: (row.goal_at_publish_cents as number | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class CampaignDraftService {
  constructor(
    private readonly db: Database.Database,
    private readonly catalog: CatalogSku[] = STUB_CATALOG,
    private readonly presetStore: PresetStore = createPresetStore(),
  ) {
    this.hydratePresetsFromDb();
  }

  private hydratePresetsFromDb(): void {
    const rows = this.db
      .prepare(`SELECT * FROM sport_presets WHERE operator_id IS NOT NULL`)
      .all() as Record<string, unknown>[];
    for (const row of rows) {
      this.presetStore.operator.push({
        id: row.id as string,
        operatorId: row.operator_id as string,
        sportKey: row.sport_key as string,
        displayName: row.display_name as string,
        dollarsPerPlayerCents: row.dollars_per_player_cents as number,
        minGoalCents: (row.min_goal_cents as number | null) ?? null,
        maxGoalCents: (row.max_goal_cents as number | null) ?? null,
        defaultProductTags: JSON.parse(row.default_product_tags as string) as string[],
        defaultSurfaceOrder: row.default_surface_order as SurfaceOrder,
        version: row.version as number,
        updatedAt: row.updated_at as string,
        updatedBy: (row.updated_by as string | null) ?? null,
      });
    }
  }

  getCatalog(): CatalogSku[] {
    return this.catalog;
  }

  listPresets(operatorId: string): SportPreset[] {
    return listSportPresets(this.presetStore, operatorId);
  }

  upsertPreset(input: PresetUpsertInput): SportPreset {
    const preset = upsertSportPreset(this.presetStore, input);
    this.db
      .prepare(
        `INSERT INTO sport_presets (
          id, operator_id, sport_key, display_name, dollars_per_player_cents,
          min_goal_cents, max_goal_cents, default_product_tags, default_surface_order,
          version, updated_at, updated_by
        ) VALUES (
          @id, @operator_id, @sport_key, @display_name, @dollars_per_player_cents,
          @min_goal_cents, @max_goal_cents, @default_product_tags, @default_surface_order,
          @version, @updated_at, @updated_by
        )
        ON CONFLICT(operator_id, sport_key) DO UPDATE SET
          display_name=excluded.display_name,
          dollars_per_player_cents=excluded.dollars_per_player_cents,
          min_goal_cents=excluded.min_goal_cents,
          max_goal_cents=excluded.max_goal_cents,
          default_product_tags=excluded.default_product_tags,
          default_surface_order=excluded.default_surface_order,
          version=excluded.version,
          updated_at=excluded.updated_at,
          updated_by=excluded.updated_by`,
      )
      .run({
        id: preset.id,
        operator_id: preset.operatorId,
        sport_key: preset.sportKey,
        display_name: preset.displayName,
        dollars_per_player_cents: preset.dollarsPerPlayerCents,
        min_goal_cents: preset.minGoalCents,
        max_goal_cents: preset.maxGoalCents,
        default_product_tags: JSON.stringify(preset.defaultProductTags),
        default_surface_order: preset.defaultSurfaceOrder,
        version: preset.version,
        updated_at: preset.updatedAt,
        updated_by: preset.updatedBy,
      });
    return preset;
  }

  async intakeUtterance(input: {
    operatorId: string;
    orgId: string;
    createdBy: string;
    utterance: string;
  }): Promise<{
    canDraft: boolean;
    score: number;
    extractedSlots: ReturnType<typeof hydrateOmniBrief>["extractedSlots"];
    missingSlots: string[];
    defaultedFields: string[];
    draft: CampaignDraft | null;
  }> {
    const preset = resolveSportPreset(this.presetStore, input.operatorId, "general");
    const hydrated = hydrateOmniBrief({
      utterance: input.utterance,
      preset,
      catalog: this.catalog,
      now: PROTOTYPE_TODAY,
    });
    if (!hydrated.canDraft || !hydrated.brief) {
      return {
        canDraft: false,
        score: hydrated.score,
        extractedSlots: hydrated.extractedSlots,
        missingSlots: hydrated.missingSlots,
        defaultedFields: [],
        draft: null,
      };
    }
    const draft = await this.createDraft({
      operatorId: input.operatorId,
      orgId: input.orgId,
      createdBy: input.createdBy,
      brief: hydrated.brief,
    });
    return {
      canDraft: true,
      score: hydrated.score,
      extractedSlots: hydrated.extractedSlots,
      missingSlots: hydrated.missingSlots,
      defaultedFields: hydrated.defaultedFields,
      draft,
    };
  }

  async createDraft(input: {
    operatorId: string;
    orgId: string;
    createdBy: string;
    brief: CampaignBrief;
  }): Promise<CampaignDraft> {
    if (!input.brief.sport?.trim()) throw new Error("sport is required");
    if (!input.brief.orgDisplayName?.trim()) throw new Error("orgDisplayName is required");
    if (!Number.isFinite(input.brief.rosterSize) || input.brief.rosterSize < 1) {
      throw new Error("rosterSize must be >= 1");
    }

    const brief = normalizeBrief(input.brief);
    resolveThemePack(brief.themeKey);

    const preset = resolveSportPreset(
      this.presetStore,
      input.operatorId,
      brief.sport,
    );
    const rules = runDraftRules({
      brief,
      preset,
      catalog: this.catalog,
    });
    const guarded = await generateGuardedCopy({
      orgName: brief.orgDisplayName,
      sport: brief.sport,
      goalCents: rules.goalCents,
      windowStart: brief.windowStart,
      windowEnd: brief.windowEnd,
      whyRules: rules.whyRules,
    });
    const copy = {
      headline: guarded.headline,
      supportingLine: guarded.supportingLine,
      whyDraft: guarded.whyDraft,
      copyStatus: guarded.usedFallback ? ("fallback" as const) : ("ok" as const),
    };

    const id = randomUUID();
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO campaign_drafts (
          id, operator_id, org_id, created_by, brief_json, preset_id, preset_version,
          goal_cents, surface_order, sku_ids_json, note_filter_json,
          headline, supporting_line, why_draft, why_rules, copy_status, status,
          campaign_id, goal_at_publish_cents, created_at, updated_at
        ) VALUES (
          @id, @operator_id, @org_id, @created_by, @brief_json, @preset_id, @preset_version,
          @goal_cents, @surface_order, @sku_ids_json, @note_filter_json,
          @headline, @supporting_line, @why_draft, @why_rules, @copy_status, 'draft',
          NULL, NULL, @created_at, @updated_at
        )`,
      )
      .run({
        id,
        operator_id: input.operatorId,
        org_id: input.orgId,
        created_by: input.createdBy,
        brief_json: JSON.stringify(brief),
        preset_id: preset.id,
        preset_version: preset.version,
        goal_cents: rules.goalCents,
        surface_order: rules.surfaceOrder,
        sku_ids_json: JSON.stringify(rules.skuIds),
        note_filter_json: JSON.stringify(rules.noteFilter),
        headline: copy.headline,
        supporting_line: copy.supportingLine,
        why_draft: copy.whyDraft,
        why_rules: rules.whyRules,
        copy_status: copy.copyStatus,
        created_at: ts,
        updated_at: ts,
      });

    return this.getDraft(input.operatorId, id)!;
  }

  getDraft(operatorId: string, id: string): CampaignDraft | null {
    const row = this.db
      .prepare(`SELECT * FROM campaign_drafts WHERE id = ? AND operator_id = ?`)
      .get(id, operatorId) as Record<string, unknown> | undefined;
    return row ? rowToDraft(row) : null;
  }

  updateDraft(
    operatorId: string,
    id: string,
    patch: Partial<{
      goalCents: number;
      surfaceOrder: SurfaceOrder;
      skuIds: string[];
      headline: string;
      supportingLine: string;
      whyDraft: string;
    }>,
  ): CampaignDraft {
    const existing = this.getDraft(operatorId, id);
    if (!existing) throw new Error("Draft not found");
    if (existing.status !== "draft") throw new Error("Only draft status can be edited");

    const next = {
      goalCents: patch.goalCents ?? existing.goalCents,
      surfaceOrder: patch.surfaceOrder ?? existing.surfaceOrder,
      skuIds: patch.skuIds ?? existing.skuIds,
      headline: patch.headline ?? existing.headline,
      supportingLine: patch.supportingLine ?? existing.supportingLine,
      whyDraft: patch.whyDraft ?? existing.whyDraft,
    };

    this.db
      .prepare(
        `UPDATE campaign_drafts SET
          goal_cents = @goal_cents,
          surface_order = @surface_order,
          sku_ids_json = @sku_ids_json,
          headline = @headline,
          supporting_line = @supporting_line,
          why_draft = @why_draft,
          updated_at = @updated_at
        WHERE id = @id AND operator_id = @operator_id`,
      )
      .run({
        id,
        operator_id: operatorId,
        goal_cents: next.goalCents,
        surface_order: next.surfaceOrder,
        sku_ids_json: JSON.stringify(next.skuIds),
        headline: next.headline,
        supporting_line: next.supportingLine,
        why_draft: next.whyDraft,
        updated_at: nowIso(),
      });

    return this.getDraft(operatorId, id)!;
  }

  publishDraft(operatorId: string, id: string): {
    draft: CampaignDraft;
    campaign: PublishedCampaign;
  } {
    const existing = this.getDraft(operatorId, id);
    if (!existing) throw new Error("Draft not found");

    if (existing.status === "published" && existing.campaignId) {
      const campaign = this.getCampaign(operatorId, existing.campaignId)!;
      return { draft: existing, campaign };
    }

    if (!existing.headline.trim()) {
      throw new Error("Headline required before publish");
    }

    const campaignId = randomUUID();
    const ts = nowIso();
    const name = existing.headline;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO campaigns (
            id, operator_id, org_id, name, goal_cents, surface_order, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        )
        .run(
          campaignId,
          operatorId,
          existing.orgId,
          name,
          existing.goalCents,
          existing.surfaceOrder,
          ts,
        );

      const offerStmt = this.db.prepare(
        `INSERT INTO campaign_offers (id, campaign_id, product_id, sort_order) VALUES (?, ?, ?, ?)`,
      );
      existing.skuIds.forEach((skuId, idx) => {
        offerStmt.run(randomUUID(), campaignId, skuId, idx);
      });

      this.db
        .prepare(
          `UPDATE campaign_drafts SET
            status = 'published',
            campaign_id = ?,
            goal_at_publish_cents = ?,
            updated_at = ?
          WHERE id = ? AND operator_id = ?`,
        )
        .run(campaignId, existing.goalCents, ts, id, operatorId);
    });
    tx();

    const draft = this.getDraft(operatorId, id)!;
    const campaign = this.getCampaign(operatorId, campaignId)!;
    return { draft, campaign };
  }

  getCampaign(operatorId: string, id: string): PublishedCampaign | null {
    const row = this.db
      .prepare(`SELECT * FROM campaigns WHERE id = ? AND operator_id = ?`)
      .get(id, operatorId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const offers = this.db
      .prepare(
        `SELECT product_id FROM campaign_offers WHERE campaign_id = ? ORDER BY sort_order`,
      )
      .all(id) as { product_id: string }[];
    return {
      id: row.id as string,
      operatorId: row.operator_id as string,
      orgId: row.org_id as string,
      name: row.name as string,
      goalCents: row.goal_cents as number,
      surfaceOrder: row.surface_order as SurfaceOrder,
      status: "active",
      offerProductIds: offers.map((o) => o.product_id),
    };
  }
}
