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

export type BuildStepStatus = "found" | "assumed" | "missing";

/** One thing the generator read or decided, shown to the admin as a step in the build. */
export interface TemplateBuildStep {
  id: "sport" | "look" | "goals" | "catalog" | "ready";
  label: string;
  value: string;
  detail: string;
  status: BuildStepStatus;
}

/** A one-tap edit: `prompt` is the rewritten request to run next. */
export interface TemplateRefinement {
  id: string;
  label: string;
  prompt: string;
}

export interface GenerateTemplatePackResult {
  pack: DraftTemplatePack;
  reply: string;
  suggestions: string[];
  steps: TemplateBuildStep[];
  refinements: TemplateRefinement[];
  canPublish: boolean;
}

export interface GenerateTemplatePackContext {
  operatorId?: string | null;
  scope?: PublishScope;
}
