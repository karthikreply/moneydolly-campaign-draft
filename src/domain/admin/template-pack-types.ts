import type { CampaignThemePack } from "../campaign-draft/theme-packs";
import type { CatalogSku, SurfaceOrder } from "../campaign-draft/types";

export type PublishScope = "platform" | "operator";

export interface TemplateSportPreset {
  sportKey: string;
  displayName: string;
  dollarsPerPlayerCents: number;
  minGoalCents: number | null;
  maxGoalCents: number | null;
  defaultProductTags: string[];
  defaultSurfaceOrder: SurfaceOrder;
  version: number;
}

export interface DraftTemplatePack {
  id: string;
  sportPreset: TemplateSportPreset;
  theme: CampaignThemePack;
  catalogSkus: CatalogSku[];
  tags: string[];
}

export interface PublishedTemplatePack extends DraftTemplatePack {
  scope: PublishScope;
  operatorId: string | null;
  publishedAt: string;
}

export interface GenerateTemplatePackResult {
  pack: DraftTemplatePack;
  reply: string;
  suggestions: string[];
  canPublish: boolean;
}

export interface GenerateTemplatePackContext {
  operatorId?: string | null;
  scope?: PublishScope;
}
