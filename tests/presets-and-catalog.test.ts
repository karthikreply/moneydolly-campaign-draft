import { describe, expect, it, beforeEach } from "vitest";
import { generateTemplatePack } from "../src/domain/admin/generate-template-pack";
import {
  getThemeFromRegistry,
  listCatalog,
  listSports,
  listThemes,
  publishPack,
  resetRegistryForTests,
  serializeRegistry,
  deserializeRegistry,
} from "../src/domain/admin/presets-and-catalog";

describe("PresetsAndCatalog registry", () => {
  beforeEach(() => resetRegistryForTests());

  it("publishes platform pack and exposes theme, sport, and catalog", () => {
    const { pack } = generateTemplatePack(
      "Spring Lacrosse template, min $2000, max $8000, 5 merch under $35",
      { operatorId: "op1" },
    );
    publishPack(pack, "platform", null);

    expect(listSports("op1").some((s) => s.sportKey === "lacrosse")).toBe(true);
    expect(listThemes("op1").some((t) => t.key === pack.theme.key)).toBe(true);
    expect(listCatalog("op1").some((s) => s.id === pack.catalogSkus[0].id)).toBe(true);
    expect(getThemeFromRegistry(pack.theme.key, "op1")?.name).toBe(pack.theme.name);
  });

  it("operator override wins on same sport key", () => {
    const base = generateTemplatePack("Lacrosse template 5 items under $35").pack;
    publishPack(base, "platform", null);

    const override = generateTemplatePack("Lacrosse template 4 items under $30").pack;
    override.sportPreset.displayName = "Operator Lax";
    publishPack(override, "operator", "op1");

    const resolved = listSports("op1").find((s) => s.sportKey === "lacrosse");
    expect(resolved?.displayName).toBe("Operator Lax");

    const otherOp = listSports("op2").find((s) => s.sportKey === "lacrosse");
    expect(otherOp?.displayName).toBe(base.sportPreset.displayName);
  });

  it("round-trips serialize and deserialize", () => {
    const { pack } = generateTemplatePack("Lacrosse spring template 5 items under $40");
    publishPack(pack, "platform", null);
    const snap = serializeRegistry();
    const skuId = pack.catalogSkus[0].id;
    resetRegistryForTests();
    expect(listCatalog("op1").some((s) => s.id === skuId)).toBe(false);
    deserializeRegistry(snap);
    expect(listCatalog("op1").some((s) => s.id === skuId)).toBe(true);
  });
});
