import type { SportPreset, SurfaceOrder } from "./types";

/** Works in Node and the browser bundle; no node: scheme import. */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export interface PresetUpsertInput {
  operatorId: string;
  sportKey: string;
  displayName: string;
  dollarsPerPlayerCents: number;
  minGoalCents?: number | null;
  maxGoalCents?: number | null;
  defaultProductTags: string[];
  defaultSurfaceOrder: SurfaceOrder;
  updatedBy?: string | null;
}

export interface PresetStore {
  platform: SportPreset[];
  operator: SportPreset[];
}

const PLATFORM_DEFAULTS: Omit<SportPreset, "id" | "updatedAt">[] = [
  {
    operatorId: null,
    sportKey: "volleyball",
    displayName: "Volleyball",
    dollarsPerPlayerCents: 15000,
    minGoalCents: 50000,
    maxGoalCents: 5000000,
    defaultProductTags: ["volleyball"],
    defaultSurfaceOrder: "shop_first",
    version: 1,
    updatedBy: null,
  },
  {
    operatorId: null,
    sportKey: "basketball",
    displayName: "Basketball",
    dollarsPerPlayerCents: 17500,
    minGoalCents: 50000,
    maxGoalCents: 5000000,
    defaultProductTags: ["basketball"],
    defaultSurfaceOrder: "shop_first",
    version: 1,
    updatedBy: null,
  },
  {
    operatorId: null,
    sportKey: "soccer",
    displayName: "Soccer",
    dollarsPerPlayerCents: 12500,
    minGoalCents: 40000,
    maxGoalCents: 4000000,
    defaultProductTags: ["soccer"],
    defaultSurfaceOrder: "shop_first",
    version: 1,
    updatedBy: null,
  },
  {
    operatorId: null,
    sportKey: "general",
    displayName: "General / other",
    dollarsPerPlayerCents: 10000,
    minGoalCents: 25000,
    maxGoalCents: 3000000,
    defaultProductTags: ["generic"],
    defaultSurfaceOrder: "donate_first",
    version: 1,
    updatedBy: null,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

export function createPresetStore(seedOperator: SportPreset[] = []): PresetStore {
  return {
    platform: PLATFORM_DEFAULTS.map((p) => ({
      ...p,
      id: `plat_${p.sportKey}`,
      updatedAt: nowIso(),
    })),
    operator: [...seedOperator],
  };
}

export function resolveSportPreset(
  store: PresetStore,
  operatorId: string,
  sportKey: string,
): SportPreset {
  const key = sportKey.toLowerCase();
  const override = store.operator.find(
    (p) => p.operatorId === operatorId && p.sportKey === key,
  );
  if (override) return override;

  const platform = store.platform.find((p) => p.sportKey === key);
  if (platform) return platform;

  const general = store.platform.find((p) => p.sportKey === "general");
  if (!general) {
    throw new Error("Platform general sport preset missing");
  }
  return general;
}

export function upsertSportPreset(
  store: PresetStore,
  input: PresetUpsertInput,
): SportPreset {
  const key = input.sportKey.toLowerCase();
  const existingIdx = store.operator.findIndex(
    (p) => p.operatorId === input.operatorId && p.sportKey === key,
  );

  if (existingIdx >= 0) {
    const existing = store.operator[existingIdx];
    const next: SportPreset = {
      ...existing,
      displayName: input.displayName,
      dollarsPerPlayerCents: input.dollarsPerPlayerCents,
      minGoalCents: input.minGoalCents ?? existing.minGoalCents,
      maxGoalCents: input.maxGoalCents ?? existing.maxGoalCents,
      defaultProductTags: input.defaultProductTags,
      defaultSurfaceOrder: input.defaultSurfaceOrder,
      version: existing.version + 1,
      updatedAt: nowIso(),
      updatedBy: input.updatedBy ?? null,
    };
    store.operator[existingIdx] = next;
    return next;
  }

  const created: SportPreset = {
    id: randomUUID(),
    operatorId: input.operatorId,
    sportKey: key,
    displayName: input.displayName,
    dollarsPerPlayerCents: input.dollarsPerPlayerCents,
    minGoalCents: input.minGoalCents ?? null,
    maxGoalCents: input.maxGoalCents ?? null,
    defaultProductTags: input.defaultProductTags,
    defaultSurfaceOrder: input.defaultSurfaceOrder,
    version: 1,
    updatedAt: nowIso(),
    updatedBy: input.updatedBy ?? null,
  };
  store.operator.push(created);
  return created;
}

export function listSportPresets(
  store: PresetStore,
  operatorId: string,
): SportPreset[] {
  const keys = new Set([
    ...store.platform.map((p) => p.sportKey),
    ...store.operator.filter((p) => p.operatorId === operatorId).map((p) => p.sportKey),
  ]);
  return [...keys].map((k) => resolveSportPreset(store, operatorId, k));
}
