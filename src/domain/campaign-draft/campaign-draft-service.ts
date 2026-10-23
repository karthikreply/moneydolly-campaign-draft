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
import {
  applyRegistryToPresetStore,
  deserializeRegistry,
  findPublishedSport,
  listAllCatalog,
  listCatalog,
  listSports,
} from "../admin/presets-and-catalog";
import type { PublishedTemplatePack } from "../admin/template-pack-types";
import { STUB_CATALOG } from "./stub-catalog";
import { isThemeKey, resolveThemePack } from "./theme-packs";
import { quoteCheckout } from "./checkout";
import { campaignSlug, slugify, uniqueSlug } from "./slug";
import type {
  CampaignBrief,
  CampaignDraft,
  CampaignProgress,
  CatalogSku,
  CheckoutInput,
  CheckoutQuote,
  NoteFilterResult,
  Participant,
  PlacedOrder,
  PublishedCampaign,
  SportPreset,
  SurfaceOrder,
} from "./types";

/** Seed roster used when a campaign is published from a draft (no roster import yet). */
const SEED_ROSTER = [
  "Jordan Lee",
  "Priya Nair",
  "Marcus Hill",
  "Sofia Alvarez",
  "Ethan Brooks",
  "Maya Chen",
];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeBrief(raw: CampaignBrief): CampaignBrief {
  const themeKey = raw.themeKey?.trim() ? raw.themeKey : "classic_season";
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
    this.hydrateTemplateRegistryFromDb();
  }

  private hydrateTemplateRegistryFromDb(): void {
    const rows = this.db
      .prepare(`SELECT payload_json FROM template_registry ORDER BY updated_at ASC`)
      .all() as { payload_json: string }[];
    if (!rows.length) return;
    const published = rows.map((row) => JSON.parse(row.payload_json) as PublishedTemplatePack);
    deserializeRegistry({ published });
    applyRegistryToPresetStore(this.presetStore, "op1");
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

  private catalogFor(operatorId: string): CatalogSku[] {
    return listCatalog(operatorId);
  }

  /** Lookup catalog for published offers: built-in SKUs plus every studio-published SKU. */
  getCatalog(operatorId?: string): CatalogSku[] {
    this.hydrateTemplateRegistryFromDb();
    if (operatorId) return this.catalogFor(operatorId);
    const byId = new Map(this.catalog.map((sku) => [sku.id, sku]));
    for (const sku of listAllCatalog()) if (!byId.has(sku.id)) byId.set(sku.id, sku);
    return [...byId.values()];
  }

  listPresets(operatorId: string): SportPreset[] {
    applyRegistryToPresetStore(this.presetStore, operatorId);
    return listSports(operatorId);
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
    applyRegistryToPresetStore(this.presetStore, input.operatorId);
    const preset = resolveSportPreset(this.presetStore, input.operatorId, "general");
    const hydrated = hydrateOmniBrief({
      utterance: input.utterance,
      preset,
      catalog: this.catalogFor(input.operatorId),
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

  /** `brandId` is the white-label operator from the switcher; it picks which registry layer applies. */
  async createDraft(input: {
    operatorId: string;
    orgId: string;
    createdBy: string;
    brief: CampaignBrief;
    brandId?: string;
  }): Promise<CampaignDraft> {
    if (!input.brief.sport?.trim()) throw new Error("sport is required");
    if (!input.brief.orgDisplayName?.trim()) throw new Error("orgDisplayName is required");
    if (!Number.isFinite(input.brief.rosterSize) || input.brief.rosterSize < 1) {
      throw new Error("rosterSize must be >= 1");
    }

    const brief = normalizeBrief(input.brief);
    this.hydrateTemplateRegistryFromDb();
    const scope = input.brandId ?? input.operatorId;
    resolveThemePack(brief.themeKey, scope);

    applyRegistryToPresetStore(this.presetStore, input.operatorId);
    const preset =
      findPublishedSport(scope, brief.sport) ??
      resolveSportPreset(this.presetStore, input.operatorId, brief.sport);
    const rules = runDraftRules({
      brief,
      preset,
      catalog: this.catalogFor(scope),
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
    roster: Participant[];
  } {
    const existing = this.getDraft(operatorId, id);
    if (!existing) throw new Error("Draft not found");

    if (existing.status === "published" && existing.campaignId) {
      const campaign = this.getCampaign(operatorId, existing.campaignId)!;
      return { draft: existing, campaign, roster: this.listParticipants(campaign.id) };
    }

    if (!existing.headline.trim()) {
      throw new Error("Headline required before publish");
    }

    const campaignId = randomUUID();
    const ts = nowIso();
    const name = existing.headline;
    const slugTaken = this.db.prepare(`SELECT 1 FROM campaigns WHERE slug = ?`);
    const slug = uniqueSlug(
      campaignSlug(existing.brief.orgDisplayName, existing.brief.sport),
      (candidate) => Boolean(slugTaken.get(candidate)),
    );

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO campaigns (
            id, operator_id, org_id, name, slug, headline, supporting_line, theme_key,
            org_display_name, ends_at, goal_cents, surface_order, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        )
        .run(
          campaignId,
          operatorId,
          existing.orgId,
          name,
          slug,
          existing.headline,
          existing.supportingLine,
          existing.brief.themeKey,
          existing.brief.orgDisplayName,
          existing.brief.windowEnd,
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

      const rosterSize = Math.max(1, existing.brief.rosterSize);
      const perPlayer = Math.round(existing.goalCents / rosterSize);
      const participantStmt = this.db.prepare(
        `INSERT INTO participants (
          id, campaign_id, org_id, display_name, slug, goal_cents, is_minor, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      );
      SEED_ROSTER.slice(0, Math.min(SEED_ROSTER.length, rosterSize)).forEach((displayName) => {
        participantStmt.run(
          randomUUID(),
          campaignId,
          existing.orgId,
          displayName,
          slugify(displayName),
          perPlayer,
          ts,
        );
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
    return { draft, campaign, roster: this.listParticipants(campaignId) };
  }

  private rowToCampaign(row: Record<string, unknown>): PublishedCampaign {
    const id = row.id as string;
    const offers = this.db
      .prepare(
        `SELECT product_id FROM campaign_offers WHERE campaign_id = ? ORDER BY sort_order`,
      )
      .all(id) as { product_id: string }[];
    return {
      id,
      operatorId: row.operator_id as string,
      orgId: row.org_id as string,
      name: row.name as string,
      slug: (row.slug as string | null) ?? id,
      headline: (row.headline as string | null) ?? (row.name as string),
      supportingLine: (row.supporting_line as string | null) ?? "",
      themeKey: (row.theme_key as string | null) ?? "classic_season",
      orgDisplayName: (row.org_display_name as string | null) ?? (row.name as string),
      endsAt: (row.ends_at as string | null) ?? "",
      goalCents: row.goal_cents as number,
      surfaceOrder: row.surface_order as SurfaceOrder,
      status: "active",
      offerProductIds: offers.map((o) => o.product_id),
    };
  }

  getCampaign(operatorId: string, id: string): PublishedCampaign | null {
    const row = this.db
      .prepare(`SELECT * FROM campaigns WHERE id = ? AND operator_id = ?`)
      .get(id, operatorId) as Record<string, unknown> | undefined;
    return row ? this.rowToCampaign(row) : null;
  }

  /** Public read: the supporter link has no tenant context, only the slug. */
  getCampaignBySlug(slug: string): PublishedCampaign | null {
    const row = this.db
      .prepare(`SELECT * FROM campaigns WHERE slug = ? AND status = 'active'`)
      .get(slug) as Record<string, unknown> | undefined;
    return row ? this.rowToCampaign(row) : null;
  }

  listParticipants(campaignId: string): Participant[] {
    const rows = this.db
      .prepare(`SELECT * FROM participants WHERE campaign_id = ? ORDER BY display_name`)
      .all(campaignId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      campaignId: row.campaign_id as string,
      orgId: row.org_id as string,
      displayName: row.display_name as string,
      slug: row.slug as string,
      goalCents: row.goal_cents as number,
      isMinor: Boolean(row.is_minor),
    }));
  }

  getParticipantBySlug(campaignId: string, slug: string): Participant | null {
    return this.listParticipants(campaignId).find((p) => p.slug === slug) ?? null;
  }

  getProgress(campaignId: string, participantId?: string | null): CampaignProgress {
    const row = (
      participantId
        ? this.db
            .prepare(
              `SELECT COALESCE(SUM(goal_credit_cents), 0) AS raised, COUNT(*) AS n
               FROM orders WHERE campaign_id = ? AND participant_id = ?`,
            )
            .get(campaignId, participantId)
        : this.db
            .prepare(
              `SELECT COALESCE(SUM(goal_credit_cents), 0) AS raised, COUNT(*) AS n
               FROM orders WHERE campaign_id = ?`,
            )
            .get(campaignId)
    ) as { raised: number; n: number };
    const goal = participantId
      ? (this.listParticipants(campaignId).find((p) => p.id === participantId)?.goalCents ?? 0)
      : (this.db
          .prepare(`SELECT goal_cents FROM campaigns WHERE id = ?`)
          .get(campaignId) as { goal_cents: number } | undefined)?.goal_cents ?? 0;
    return { raisedCents: row.raised, goalCents: goal, orderCount: row.n };
  }

  quote(input: CheckoutInput, donationFeeBps: number): CheckoutQuote {
    const campaign = this.getCampaignBySlug(input.campaignSlug);
    if (!campaign) throw new Error("Campaign not found");
    return quoteCheckout(
      this.getCatalog(),
      campaign.offerProductIds,
      input.lines,
      input.donationCents,
      donationFeeBps,
    );
  }

  /**
   * Mock checkout. No card data touches this code; a real build hands off to
   * Stripe Checkout and records the order from the webhook.
   */
  placeOrder(input: CheckoutInput, donationFeeBps: number): PlacedOrder {
    const campaign = this.getCampaignBySlug(input.campaignSlug);
    if (!campaign) throw new Error("Campaign not found");
    if (!input.supporterName.trim()) throw new Error("Supporter name is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.supporterEmail)) {
      throw new Error("A valid email is required");
    }

    const participant = input.participantSlug
      ? this.getParticipantBySlug(campaign.id, input.participantSlug)
      : null;
    if (input.participantSlug && !participant) throw new Error("Participant not found");

    const quote = this.quote(input, donationFeeBps);
    if (quote.totalCents <= 0) throw new Error("Add an item or a donation first");

    const orderId = randomUUID();
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO orders (
            id, campaign_id, participant_id, supporter_name, supporter_email,
            subtotal_cents, shipping_cents, total_cents, goal_credit_cents, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid_mock', ?)`,
        )
        .run(
          orderId,
          campaign.id,
          participant?.id ?? null,
          input.supporterName.trim(),
          input.supporterEmail.trim(),
          quote.subtotalCents,
          quote.shippingCents,
          quote.totalCents,
          quote.goalCreditCents,
          ts,
        );
      const lineStmt = this.db.prepare(
        `INSERT INTO order_lines (id, order_id, type, product_id, qty, unit_cents, group_credit_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const line of quote.lines) {
        lineStmt.run(
          randomUUID(),
          orderId,
          "product",
          line.productId,
          line.qty,
          line.unitCents,
          line.groupCreditCents,
        );
      }
      if (quote.donationCents > 0) {
        lineStmt.run(
          randomUUID(),
          orderId,
          "donation",
          null,
          1,
          quote.donationCents,
          quote.donationCents - quote.donationFeeCents,
        );
      }
      if (quote.shippingCents > 0) {
        lineStmt.run(randomUUID(), orderId, "shipping", null, 1, quote.shippingCents, 0);
      }
    });
    tx();

    return {
      id: orderId,
      campaignId: campaign.id,
      participantId: participant?.id ?? null,
      totalCents: quote.totalCents,
      goalCreditCents: quote.goalCreditCents,
      status: "paid_mock",
    };
  }
}
