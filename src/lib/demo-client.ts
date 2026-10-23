import {
  applyRegistryToPresetStore,
  getRegistryCatalog,
} from "@/domain/admin/presets-and-catalog";
import {
  MemoryCampaignStore,
  seedPublishedDemoCampaign,
  type MemoryStoreSnapshot,
} from "@/domain/campaign-draft/memory-campaign-store";
import { createPresetStore } from "@/domain/campaign-draft/sport-presets";
import type { CampaignBrief, CampaignDraft, CatalogSku } from "@/domain/campaign-draft/types";
import type { CheckoutInput } from "@/domain/campaign-draft/types";
import { feeRateToBps, findOperator } from "@/domain/operators";
import { hydrateRegistryFromStorage } from "@/lib/registry-storage";
import { DEMO } from "@/lib/demo-tenant";

const STORAGE_KEY = "md-campaign-draft-v1";

let store: MemoryCampaignStore | null = null;
let ready: Promise<void> | null = null;

export function resetDemoStore(): void {
  store = null;
  ready = null;
}

function buildMemoryStore(snapshot?: MemoryStoreSnapshot): MemoryCampaignStore {
  hydrateRegistryFromStorage();
  const presetStore = createPresetStore();
  applyRegistryToPresetStore(presetStore, DEMO.operatorId);
  const catalog = getRegistryCatalog(DEMO.operatorId);
  return new MemoryCampaignStore(catalog, presetStore, snapshot);
}

function readSnapshot(): MemoryStoreSnapshot | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as MemoryStoreSnapshot;
  } catch {
    return undefined;
  }
}

function persist(): void {
  if (typeof window === "undefined" || !store) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store.toSnapshot()));
}

async function getReadyStore(): Promise<MemoryCampaignStore> {
  if (ready) {
    await ready;
    return store!;
  }
  ready = (async () => {
    const snapshot = readSnapshot();
    store = buildMemoryStore(snapshot);
    if (!snapshot) {
      await seedPublishedDemoCampaign(store, DEMO);
      persist();
    }
  })();
  await ready;
  return store!;
}

export async function getCatalog(): Promise<CatalogSku[]> {
  return (await getReadyStore()).getCatalog();
}

export async function createDraft(brief: CampaignBrief): Promise<CampaignDraft> {
  const s = await getReadyStore();
  const draft = await s.createDraft({
    operatorId: DEMO.operatorId,
    orgId: DEMO.orgId,
    createdBy: DEMO.createdBy,
    brief,
  });
  persist();
  return draft;
}

export async function updateDraft(
  id: string,
  patch: Partial<{
    goalCents: number;
    surfaceOrder: CampaignDraft["surfaceOrder"];
    skuIds: string[];
    headline: string;
    supportingLine: string;
    whyDraft: string;
  }>,
): Promise<CampaignDraft> {
  const s = await getReadyStore();
  const draft = s.updateDraft(DEMO.operatorId, id, patch);
  persist();
  return draft;
}

export async function publishDraft(id: string) {
  const s = await getReadyStore();
  const result = s.publishDraft(DEMO.operatorId, id);
  persist();
  return result;
}

export async function intakeUtterance(utterance: string) {
  const s = await getReadyStore();
  const result = await s.intakeUtterance({
    operatorId: DEMO.operatorId,
    orgId: DEMO.orgId,
    createdBy: DEMO.createdBy,
    utterance,
  });
  persist();
  return result;
}

export async function getDraftBundle(id: string) {
  const s = await getReadyStore();
  const draft = s.getDraft(DEMO.operatorId, id);
  if (!draft) return null;
  const catalog = s.getCatalog();
  const campaign = draft.campaignId ? s.getCampaign(DEMO.operatorId, draft.campaignId) : null;
  const roster = campaign ? s.listParticipants(campaign.id) : [];
  return { draft, catalog, campaign, roster };
}

export async function getPublicCampaignBundle(slug: string, participantSlug?: string | null) {
  const s = await getReadyStore();
  const campaign = s.getCampaignBySlug(slug);
  if (!campaign) return null;
  const participant = participantSlug
    ? s.getParticipantBySlug(campaign.id, participantSlug)
    : null;
  if (participantSlug && !participant) return null;
  return {
    campaign,
    participant,
    roster: s.listParticipants(campaign.id),
    catalog: s.getCatalog(),
    progress: s.getProgress(campaign.id, participant?.id ?? null),
  };
}

export async function quoteCheckout(input: CheckoutInput, operatorId: string) {
  const s = await getReadyStore();
  const bps = feeRateToBps(findOperator(operatorId).customFeeRate);
  return s.quote(input, bps);
}

export async function payCheckout(input: CheckoutInput, operatorId: string) {
  const s = await getReadyStore();
  const bps = feeRateToBps(findOperator(operatorId).customFeeRate);
  const order = s.placeOrder(input, bps);
  persist();
  const progress = s.getProgress(order.campaignId, order.participantId);
  return { order, progress };
}
