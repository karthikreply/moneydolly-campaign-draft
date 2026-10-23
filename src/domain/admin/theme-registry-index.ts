import type { CampaignThemePack } from "../campaign-draft/theme-packs";

const platformThemes = new Map<string, CampaignThemePack>();
const operatorThemes = new Map<string, Map<string, CampaignThemePack>>();

export function clearThemeRegistryIndex(): void {
  platformThemes.clear();
  operatorThemes.clear();
}

export function registerPlatformTheme(theme: CampaignThemePack): void {
  platformThemes.set(theme.key, theme);
}

export function registerOperatorTheme(operatorId: string, theme: CampaignThemePack): void {
  let layer = operatorThemes.get(operatorId);
  if (!layer) {
    layer = new Map();
    operatorThemes.set(operatorId, layer);
  }
  layer.set(theme.key, theme);
}

export function lookupRegistryTheme(
  key: string,
  operatorId: string | null,
): CampaignThemePack | null {
  if (operatorId) {
    const op = operatorThemes.get(operatorId)?.get(key);
    if (op) return op;
  }
  const platform = platformThemes.get(key);
  if (platform) return platform;
  // Supporter pages render a published campaign without knowing which operator layer minted its theme.
  if (!operatorId) {
    for (const layer of operatorThemes.values()) {
      const found = layer.get(key);
      if (found) return found;
    }
  }
  return null;
}
