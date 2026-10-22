export type SurfaceOrder = "shop_first" | "donate_first";
export type CopyStatus = "ok" | "fallback" | "failed";
export type DraftStatus = "draft" | "published" | "discarded";

export interface CampaignBrief {
  sport: string;
  windowStart: string;
  windowEnd: string;
  rosterSize: number;
  note: string;
  orgDisplayName: string;
  /** Full theme pack key — colors, fonts, SKU tags, copy tone */
  themeKey: string;
  /** Slots filled by safe defaults after the gate passed. */
  defaultedFields?: string[];
}

export interface CatalogSku {
  id: string;
  name: string;
  retailCents: number;
  groupCreditCents: number;
  shipHandlingCents: number;
  tags: string[];
  kind: "product" | "donation";
}

export interface SportPreset {
  id: string;
  operatorId: string | null;
  sportKey: string;
  displayName: string;
  dollarsPerPlayerCents: number;
  minGoalCents: number | null;
  maxGoalCents: number | null;
  defaultProductTags: string[];
  defaultSurfaceOrder: SurfaceOrder;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export type NoteFilterResult =
  | { type: "none"; label: string }
  | { type: "max_price"; amountCents: number; label: string }
  | { type: "exclude_tag"; tag: string; label: string };

export interface DraftRulesResult {
  goalCents: number;
  skuIds: string[];
  surfaceOrder: SurfaceOrder;
  whyRules: string;
  noteFilter: NoteFilterResult;
}

export interface CopyResult {
  headline: string;
  supportingLine: string;
  whyDraft: string;
  copyStatus: CopyStatus;
}

export interface FeePreviewSample {
  kind: "donation" | "product";
  label: string;
  supporterPaysCents: number;
  programReceivesCents: number;
  towardGoalCents: number;
  notTowardGoalNote: string | null;
}

export interface CampaignDraft {
  id: string;
  operatorId: string;
  orgId: string;
  createdBy: string;
  brief: CampaignBrief;
  presetId: string;
  presetVersion: number;
  goalCents: number;
  surfaceOrder: SurfaceOrder;
  skuIds: string[];
  noteFilter: NoteFilterResult;
  headline: string;
  supportingLine: string;
  whyDraft: string;
  whyRules: string;
  copyStatus: CopyStatus;
  status: DraftStatus;
  campaignId: string | null;
  goalAtPublishCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedCampaign {
  id: string;
  operatorId: string;
  orgId: string;
  name: string;
  slug: string;
  headline: string;
  supportingLine: string;
  themeKey: string;
  orgDisplayName: string;
  endsAt: string;
  goalCents: number;
  surfaceOrder: SurfaceOrder;
  status: "active";
  offerProductIds: string[];
}

export interface Participant {
  id: string;
  campaignId: string;
  orgId: string;
  displayName: string;
  slug: string;
  goalCents: number;
  isMinor: boolean;
}

export interface OrderLineInput {
  productId: string;
  qty: number;
}

export interface CheckoutInput {
  campaignSlug: string;
  participantSlug: string | null;
  supporterName: string;
  supporterEmail: string;
  lines: OrderLineInput[];
  donationCents: number;
}

export interface CheckoutQuote {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  goalCreditCents: number;
  donationCents: number;
  donationFeeCents: number;
  lines: Array<{
    productId: string;
    name: string;
    qty: number;
    unitCents: number;
    groupCreditCents: number;
  }>;
}

export interface PlacedOrder {
  id: string;
  campaignId: string;
  participantId: string | null;
  totalCents: number;
  goalCreditCents: number;
  status: "paid_mock";
}

export interface CampaignProgress {
  raisedCents: number;
  goalCents: number;
  orderCount: number;
}
