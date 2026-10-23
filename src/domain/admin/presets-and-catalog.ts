import { createPresetStore, type PresetStore } from "../campaign-draft/sport-presets";
import { STUB_CATALOG } from "../campaign-draft/stub-catalog";
import { THEME_LIST, THEME_PACKS, type CampaignThemePack } from "../campaign-draft/theme-packs";
import type { CatalogSku, SportPreset } from "../campaign-draft/types";
import {
  clearThemeRegistryIndex,
  lookupRegistryTheme,
  registerOperatorTheme,
  registerPlatformTheme,
} from "./theme-registry-index";
import type {
  DraftTemplatePack,
  PublishedTemplatePack,
  PublishScope,
} from "./template-pack-types";

export const REGISTRY_STORAGE_KEY = "md-presets-catalog-v1";

interface Layer {
  themes: Map<string, CampaignThemePack>;
  sports: Map<string, SportPreset>;
  catalog: Map<string, CatalogSku>;
}

export interface RegistrySnapshot {
  published: PublishedTemplatePack[];
}

interface PresetsAndCatalogState {
  platform: Layer;
  operators: Map<string, Layer>;
  published: PublishedTemplatePack[];
}

function emptyLayer(): Layer {
  return {
    themes: new Map(),
    sports: new Map(),
    catalog: new Map(),
  };
}

function seedPlatformLayer(): Layer {
  const layer = emptyLayer();
  for (const theme of THEME_LIST) {
    layer.themes.set(theme.key, theme);
    registerPlatformTheme(theme);
  }
  const seededStore = createPresetStore();
  for (const preset of seededStore.platform) {
    layer.sports.set(preset.sportKey, preset);
  }
  for (const sku of STUB_CATALOG) {
    layer.catalog.set(sku.id, sku);
  }
  return layer;
}

function cloneTheme(theme: CampaignThemePack): CampaignThemePack {
  return {
    ...theme,
    colors: { ...theme.colors },
    fonts: { ...theme.fonts },
    productTags: [...theme.productTags],
    displayStyle: theme.displayStyle ? { ...theme.displayStyle } : undefined,
  };
}

function sportFromPack(pack: DraftTemplatePack, operatorId: string | null): SportPreset {
  const p = pack.sportPreset;
  return {
    id: `reg_${pack.id}_sport`,
    operatorId,
    sportKey: p.sportKey,
    displayName: p.displayName,
    dollarsPerPlayerCents: p.dollarsPerPlayerCents,
    minGoalCents: p.minGoalCents,
    maxGoalCents: p.maxGoalCents,
    defaultProductTags: [...p.defaultProductTags],
    defaultSurfaceOrder: p.defaultSurfaceOrder,
    version: p.version,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };
}

let state: PresetsAndCatalogState = {
  platform: seedPlatformLayer(),
  operators: new Map(),
  published: [],
};

function operatorLayer(operatorId: string): Layer {
  let layer = state.operators.get(operatorId);
  if (!layer) {
    layer = emptyLayer();
    state.operators.set(operatorId, layer);
  }
  return layer;
}

function resolveLayer(scope: PublishScope, operatorId: string | null): Layer {
  if (scope === "operator" && operatorId) return operatorLayer(operatorId);
  return state.platform;
}

export function resetRegistryForTests(): void {
  clearThemeRegistryIndex();
  state = {
    platform: seedPlatformLayer(),
    operators: new Map(),
    published: [],
  };
}

export function publishPack(
  pack: DraftTemplatePack,
  scope: PublishScope,
  operatorId: string | null,
): PublishedTemplatePack {
  const layer = resolveLayer(scope, operatorId);
  const opId = scope === "operator" ? operatorId : null;

  // One record per pack per layer, so publishing to Platform and then to an operator keeps both.
  const id = `${pack.id.split("@")[0]}@${opId ?? "platform"}`;

  // Republishing in the same layer replaces that pack, including its SKUs.
  const replaced = state.published.filter(
    (p) => p.scope === scope && p.operatorId === opId && (p.id === id || p.theme.key === pack.theme.key),
  );
  for (const old of replaced) {
    for (const sku of old.catalogSkus) layer.catalog.delete(sku.id);
  }
  state.published = state.published.filter((p) => !replaced.includes(p));

  const theme = cloneTheme(pack.theme);
  layer.themes.set(theme.key, theme);
  if (scope === "operator" && operatorId) registerOperatorTheme(operatorId, theme);
  else registerPlatformTheme(theme);
  layer.sports.set(pack.sportPreset.sportKey, sportFromPack(pack, opId));
  for (const sku of pack.catalogSkus) {
    layer.catalog.set(sku.id, { ...sku, tags: [...sku.tags] });
  }

  const published: PublishedTemplatePack = {
    ...pack,
    id,
    theme,
    catalogSkus: pack.catalogSkus.map((s) => ({ ...s, tags: [...s.tags] })),
    scope,
    operatorId: opId,
    publishedAt: (pack as Partial<PublishedTemplatePack>).publishedAt ?? new Date().toISOString(),
  };

  state.published.push(published);
  return published;
}

function mergedThemes(operatorId: string): CampaignThemePack[] {
  const map = new Map<string, CampaignThemePack>();
  for (const theme of state.platform.themes.values()) {
    map.set(theme.key, theme);
  }
  const op = state.operators.get(operatorId);
  if (op) {
    for (const theme of op.themes.values()) {
      map.set(theme.key, theme);
    }
  }
  return [...map.values()];
}

function mergedSports(operatorId: string): SportPreset[] {
  const map = new Map<string, SportPreset>();
  for (const sport of state.platform.sports.values()) {
    map.set(sport.sportKey, sport);
  }
  const op = state.operators.get(operatorId);
  if (op) {
    for (const sport of op.sports.values()) {
      if (sport.operatorId === operatorId) {
        map.set(sport.sportKey, sport);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function mergedCatalog(operatorId: string): CatalogSku[] {
  const map = new Map<string, CatalogSku>();
  for (const sku of state.platform.catalog.values()) {
    map.set(sku.id, sku);
  }
  const op = state.operators.get(operatorId);
  if (op) {
    for (const sku of op.catalog.values()) {
      map.set(sku.id, sku);
    }
  }
  return [...map.values()];
}

export function listThemes(operatorId: string): CampaignThemePack[] {
  return mergedThemes(operatorId);
}

export function listSports(operatorId: string): SportPreset[] {
  return mergedSports(operatorId);
}

export function listCatalog(operatorId: string): CatalogSku[] {
  return mergedCatalog(operatorId);
}

export function getThemeFromRegistry(
  key: string,
  operatorId: string | null,
): CampaignThemePack | null {
  if (!key) return null;
  const indexed = lookupRegistryTheme(key, operatorId);
  if (indexed) return indexed;
  if (key in THEME_PACKS) return THEME_PACKS[key as keyof typeof THEME_PACKS];
  return null;
}

export function listPublishedPacks(): PublishedTemplatePack[] {
  return [...state.published];
}

export function serializeRegistry(): RegistrySnapshot {
  return {
    published: state.published.map((p) => ({
      ...p,
      theme: cloneTheme(p.theme),
      catalogSkus: p.catalogSkus.map((s) => ({ ...s, tags: [...s.tags] })),
      sportPreset: { ...p.sportPreset, defaultProductTags: [...p.sportPreset.defaultProductTags] },
      tags: [...p.tags],
    })),
  };
}

export function deserializeRegistry(snapshot: RegistrySnapshot | null | undefined): void {
  resetRegistryForTests();
  if (!snapshot?.published?.length) return;
  for (const pack of snapshot.published) {
    publishPack(pack, pack.scope, pack.operatorId);
  }
}

export function applyRegistryToPresetStore(
  store: PresetStore,
  operatorId: string,
): PresetStore {
  for (const sport of mergedSports(operatorId)) {
    if (sport.operatorId) {
      const idx = store.operator.findIndex(
        (p) => p.operatorId === sport.operatorId && p.sportKey === sport.sportKey,
      );
      if (idx >= 0) store.operator[idx] = sport;
      else store.operator.push(sport);
      continue;
    }
    const platIdx = store.platform.findIndex((p) => p.sportKey === sport.sportKey);
    if (platIdx >= 0) store.platform[platIdx] = sport;
    else store.platform.push(sport);
  }
  return store;
}

export function getRegistryCatalog(operatorId: string): CatalogSku[] {
  return listCatalog(operatorId);
}

/** Every SKU in every layer, for looking up published offers by id. Selection uses listCatalog. */
export function listAllCatalog(): CatalogSku[] {
  const map = new Map<string, CatalogSku>();
  for (const sku of state.platform.catalog.values()) map.set(sku.id, sku);
  for (const layer of state.operators.values()) {
    for (const sku of layer.catalog.values()) map.set(sku.id, sku);
  }
  return [...map.values()];
}

/** A sport published from the Template Studio: this operator's layer first, then platform. */
export function findPublishedSport(operatorId: string, sportKey: string): SportPreset | null {
  const key = sportKey.toLowerCase();
  const own = state.operators.get(operatorId)?.sports.get(key);
  if (own) return own;
  const platform = state.platform.sports.get(key);
  return platform && platform.id.startsWith("reg_") ? platform : null;
}
