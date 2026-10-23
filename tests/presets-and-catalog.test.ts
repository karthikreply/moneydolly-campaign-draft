import { describe, expect, it, beforeEach } from "vitest";
import { generateTemplatePack } from "../src/domain/admin/generate-template-pack";
import { resolveThemePack } from "../src/domain/campaign-draft/theme-packs";
import {
  findPublishedSport,
  getThemeFromRegistry,
  listAllCatalog,
  listCatalog,
  listPublishedPacks,
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

  it("operator-scoped packs reach that operator's drafts and any supporter page", () => {
    const { pack } = generateTemplatePack("Spring Lacrosse template, 5 merch under $35");
    publishPack(pack, "operator", "apex");

    expect(findPublishedSport("apex", "lacrosse")?.sportKey).toBe("lacrosse");
    expect(findPublishedSport("victory", "lacrosse")).toBeNull();
    expect(findPublishedSport("apex", "volleyball")).toBeNull();

    expect(listCatalog("victory").some((s) => s.id === pack.catalogSkus[0].id)).toBe(false);
    expect(listAllCatalog().some((s) => s.id === pack.catalogSkus[0].id)).toBe(true);
    expect(resolveThemePack(pack.theme.key).name).toBe("Spring Lacrosse");
  });

  it("republishing a theme replaces the old pack and its items", () => {
    const first = generateTemplatePack("Spring Lacrosse template, 5 merch under $35").pack;
    publishPack(first, "platform", null);
    const second = generateTemplatePack("Spring Lacrosse template, 4 merch under $25").pack;
    publishPack(second, "platform", null);

    const lacrosse = listAllCatalog().filter((s) => s.id.startsWith("sku_lacrosse"));
    expect(lacrosse.map((s) => s.id).sort()).toEqual(second.catalogSkus.map((s) => s.id).sort());
    expect(listPublishedPacks()).toHaveLength(1);
  });

  it("republishing the same draft replaces it even when the id is reused", () => {
    const first = generateTemplatePack("Spring Lacrosse template, 5 merch under $35").pack;
    publishPack(first, "platform", null);
    const second = { ...generateTemplatePack("Spring Lacrosse template, 4 merch under $25").pack, id: first.id };
    publishPack(second, "platform", null);

    const lacrosse = listAllCatalog().filter((s) => s.id.startsWith("sku_lacrosse"));
    expect(lacrosse).toHaveLength(4);
    expect(listPublishedPacks()).toHaveLength(1);
  });

  it("publishing one draft to Platform and an operator keeps both, and survives a reload", () => {
    const { pack } = generateTemplatePack("Spring Lacrosse template, 5 merch under $35");
    publishPack(pack, "platform", null);
    publishPack(pack, "operator", "apex");
    expect(listPublishedPacks().map((p) => p.id).sort()).toEqual([`${pack.id}@apex`, `${pack.id}@platform`]);

    deserializeRegistry(serializeRegistry());
    expect(listPublishedPacks()).toHaveLength(2);
    expect(findPublishedSport("apex", "lacrosse")).not.toBeNull();
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
