import { generateGuardedCopy } from "@/lib/copyGenerator";
import { PROTOTYPE_TODAY } from "@/lib/hydrateIntent";
import { runDraftRules } from "./draft-rules-engine";
import { hydrateOmniBrief } from "./omni-hydrate";
import {
  applyRegistryToPresetStore,
  getRegistryCatalog,
} from "../admin/presets-and-catalog";
import {
  createPresetStore,
  resolveSportPreset,
  type PresetStore,
} from "./sport-presets";
import { STUB_CATALOG } from "./stub-catalog";
import { isThemeKey, resolveThemePack } from "./theme-packs";
import { quoteCheckout } from "./checkout";
import { slugify, uniqueSlug } from "./slug";
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

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeBrief(raw: CampaignBrief): CampaignBrief {
  const themeKey = raw.themeKey?.trim() ? raw.themeKey : "classic_season";
  return { ...raw, themeKey };
}

interface StoredOrder {
  id: string;
  campaignId: string;
  participantId: string | null;
  supporterName: string;
  supporterEmail: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  goalCreditCents: number;
  status: string;
  createdAt: string;
}

export interface MemoryStoreSnapshot {
  drafts: CampaignDraft[];
  campaigns: PublishedCampaign[];
  participants: Participant[];
  orders: StoredOrder[];
}

export class MemoryCampaignStore {
  private drafts = new Map<string, CampaignDraft>();
  private campaigns = new Map<string, PublishedCampaign>();
  private participants = new Map<string, Participant>();
  private orders: StoredOrder[] = [];
  private slugIndex = new Map<string, string>();

  constructor(
    private readonly catalog: CatalogSku[] = STUB_CATALOG,
    private readonly presetStore: PresetStore = createPresetStore(),
    snapshot?: MemoryStoreSnapshot,
  ) {
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  loadSnapshot(snapshot: MemoryStoreSnapshot): void {
    this.drafts.clear();
    this.campaigns.clear();
    this.participants.clear();
    this.orders = [...snapshot.orders];
    this.slugIndex.clear();
    for (const draft of snapshot.drafts) {
      this.drafts.set(draft.id, draft);
    }
    for (const campaign of snapshot.campaigns) {
      this.campaigns.set(campaign.id, campaign);
      this.slugIndex.set(campaign.slug, campaign.id);
    }
    for (const participant of snapshot.participants) {
      this.participants.set(participant.id, participant);
    }
  }

  toSnapshot(): MemoryStoreSnapshot {
    return {
      drafts: [...this.drafts.values()],
      campaigns: [...this.campaigns.values()],
      participants: [...this.participants.values()],
      orders: [...this.orders],
    };
  }

  hasCampaignSlug(slug: string): boolean {
    return this.slugIndex.has(slug);
  }

  getCatalog(): CatalogSku[] {
    return this.catalog;
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
    resolveThemePack(brief.themeKey, input.operatorId);

    applyRegistryToPresetStore(this.presetStore, input.operatorId);
    const preset = resolveSportPreset(this.presetStore, input.operatorId, brief.sport);
    const catalog = getRegistryCatalog(input.operatorId);
    const rules = runDraftRules({
      brief,
      preset,
      catalog,
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

    const id = uuid();
    const ts = nowIso();
    const draft: CampaignDraft = {
      id,
      operatorId: input.operatorId,
      orgId: input.orgId,
      createdBy: input.createdBy,
      brief,
      presetId: preset.id,
      presetVersion: preset.version,
      goalCents: rules.goalCents,
      surfaceOrder: rules.surfaceOrder,
      skuIds: rules.skuIds,
      noteFilter: rules.noteFilter as NoteFilterResult,
      headline: copy.headline,
      supportingLine: copy.supportingLine,
      whyDraft: copy.whyDraft,
      whyRules: rules.whyRules,
      copyStatus: copy.copyStatus,
      status: "draft",
      campaignId: null,
      goalAtPublishCents: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.drafts.set(id, draft);
    return draft;
  }

  getDraft(operatorId: string, id: string): CampaignDraft | null {
    const draft = this.drafts.get(id);
    return draft && draft.operatorId === operatorId ? draft : null;
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

    const next: CampaignDraft = {
      ...existing,
      goalCents: patch.goalCents ?? existing.goalCents,
      surfaceOrder: patch.surfaceOrder ?? existing.surfaceOrder,
      skuIds: patch.skuIds ?? existing.skuIds,
      headline: patch.headline ?? existing.headline,
      supportingLine: patch.supportingLine ?? existing.supportingLine,
      whyDraft: patch.whyDraft ?? existing.whyDraft,
      updatedAt: nowIso(),
    };
    this.drafts.set(id, next);
    return next;
  }

  publishDraft(
    operatorId: string,
    id: string,
  ): {
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

    const campaignId = uuid();
    const ts = nowIso();
    const name = existing.headline;
    const slug = uniqueSlug(
      slugify(`${existing.brief.orgDisplayName} ${existing.brief.sport}`),
      (candidate) => this.slugIndex.has(candidate),
    );

    const campaign: PublishedCampaign = {
      id: campaignId,
      operatorId,
      orgId: existing.orgId,
      name,
      slug,
      headline: existing.headline,
      supportingLine: existing.supportingLine,
      themeKey: existing.brief.themeKey,
      orgDisplayName: existing.brief.orgDisplayName,
      endsAt: existing.brief.windowEnd,
      goalCents: existing.goalCents,
      surfaceOrder: existing.surfaceOrder,
      status: "active",
      offerProductIds: [...existing.skuIds],
    };
    this.campaigns.set(campaignId, campaign);
    this.slugIndex.set(slug, campaignId);

    const rosterSize = Math.max(1, existing.brief.rosterSize);
    const perPlayer = Math.round(existing.goalCents / rosterSize);
    SEED_ROSTER.slice(0, Math.min(SEED_ROSTER.length, rosterSize)).forEach((displayName) => {
      const participant: Participant = {
        id: uuid(),
        campaignId,
        orgId: existing.orgId,
        displayName,
        slug: slugify(displayName),
        goalCents: perPlayer,
        isMinor: true,
      };
      this.participants.set(participant.id, participant);
    });

    const publishedDraft: CampaignDraft = {
      ...existing,
      status: "published",
      campaignId,
      goalAtPublishCents: existing.goalCents,
      updatedAt: ts,
    };
    this.drafts.set(id, publishedDraft);

    return {
      draft: publishedDraft,
      campaign,
      roster: this.listParticipants(campaignId),
    };
  }

  getCampaign(operatorId: string, id: string): PublishedCampaign | null {
    const campaign = this.campaigns.get(id);
    return campaign && campaign.operatorId === operatorId ? campaign : null;
  }

  getCampaignBySlug(slug: string): PublishedCampaign | null {
    const id = this.slugIndex.get(slug);
    if (!id) return null;
    const campaign = this.campaigns.get(id);
    return campaign?.status === "active" ? campaign : null;
  }

  listParticipants(campaignId: string): Participant[] {
    return [...this.participants.values()]
      .filter((p) => p.campaignId === campaignId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  getParticipantBySlug(campaignId: string, slug: string): Participant | null {
    return this.listParticipants(campaignId).find((p) => p.slug === slug) ?? null;
  }

  getProgress(campaignId: string, participantId?: string | null): CampaignProgress {
    const relevant = this.orders.filter((o) => {
      if (o.campaignId !== campaignId) return false;
      if (participantId) return o.participantId === participantId;
      return true;
    });
    const raisedCents = relevant.reduce((sum, o) => sum + o.goalCreditCents, 0);
    const goalCents = participantId
      ? (this.listParticipants(campaignId).find((p) => p.id === participantId)?.goalCents ?? 0)
      : (this.campaigns.get(campaignId)?.goalCents ?? 0);
    return { raisedCents, goalCents, orderCount: relevant.length };
  }

  quote(input: CheckoutInput, donationFeeBps: number): CheckoutQuote {
    const campaign = this.getCampaignBySlug(input.campaignSlug);
    if (!campaign) throw new Error("Campaign not found");
    return quoteCheckout(
      this.catalog,
      campaign.offerProductIds,
      input.lines,
      input.donationCents,
      donationFeeBps,
    );
  }

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

    const orderId = uuid();
    const ts = nowIso();
    this.orders.push({
      id: orderId,
      campaignId: campaign.id,
      participantId: participant?.id ?? null,
      supporterName: input.supporterName.trim(),
      supporterEmail: input.supporterEmail.trim(),
      subtotalCents: quote.subtotalCents,
      shippingCents: quote.shippingCents,
      totalCents: quote.totalCents,
      goalCreditCents: quote.goalCreditCents,
      status: "paid_mock",
      createdAt: ts,
    });

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

/** Published Lincoln Volleyball demo for first-load reviewers (slug: lincoln-volleyball). */
export async function seedPublishedDemoCampaign(
  store: MemoryCampaignStore,
  tenant: { operatorId: string; orgId: string; createdBy: string },
): Promise<void> {
  if (store.hasCampaignSlug("lincoln-volleyball")) return;
  const draft = await store.createDraft({
    operatorId: tenant.operatorId,
    orgId: tenant.orgId,
    createdBy: tenant.createdBy,
    brief: {
      sport: "volleyball",
      windowStart: "2026-03-01",
      windowEnd: "2026-04-15",
      rosterSize: 18,
      note: "Keep items under $25",
      orgDisplayName: "Lincoln Volleyball",
      themeKey: "classic_season",
    },
  });
  store.publishDraft(tenant.operatorId, draft.id);
}
