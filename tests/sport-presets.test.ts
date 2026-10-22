import { describe, expect, it } from "vitest";
import {
  createPresetStore,
  resolveSportPreset,
  upsertSportPreset,
} from "../src/domain/campaign-draft/sport-presets";

describe("sport presets", () => {
  it("operator override wins and bumps version", () => {
    const store = createPresetStore();
    const first = upsertSportPreset(store, {
      operatorId: "op1",
      sportKey: "volleyball",
      displayName: "Volleyball",
      dollarsPerPlayerCents: 15000,
      defaultProductTags: ["volleyball"],
      defaultSurfaceOrder: "shop_first",
    });
    expect(first.version).toBe(1);
    const second = upsertSportPreset(store, {
      operatorId: "op1",
      sportKey: "volleyball",
      displayName: "Volleyball",
      dollarsPerPlayerCents: 17500,
      defaultProductTags: ["volleyball"],
      defaultSurfaceOrder: "shop_first",
    });
    expect(second.version).toBe(2);
    expect(resolveSportPreset(store, "op1", "volleyball").dollarsPerPlayerCents).toBe(
      17500,
    );
  });

  it("falls back to platform default", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "basketball");
    expect(preset.operatorId).toBeNull();
    expect(preset.dollarsPerPlayerCents).toBe(17500);
  });
});
