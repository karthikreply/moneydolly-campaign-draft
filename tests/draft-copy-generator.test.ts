import { describe, expect, it } from "vitest";
import {
  fallbackCopy,
  generateDraftCopy,
  type LlmClient,
} from "../src/domain/campaign-draft/draft-copy-generator";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";

const brief = {
  sport: "volleyball",
  windowStart: "2026-03-01",
  windowEnd: "2026-04-15",
  rosterSize: 20,
  note: "",
  orgDisplayName: "Lincoln VB",
  themeKey: "classic_season",
};

describe("generateDraftCopy", () => {
  it("returns ok copy from template LLM", async () => {
    const result = await generateDraftCopy({
      brief,
      goalCents: 300000,
      catalog: STUB_CATALOG,
      skuIds: ["sku_donation", "sku_vb_tee"],
    });
    expect(result.copyStatus).toBe("ok");
    expect(result.headline.length).toBeGreaterThan(0);
  });

  it("falls back on timeout", async () => {
    const slow: LlmClient = {
      async generate() {
        await new Promise((r) => setTimeout(r, 100));
        return { headline: "x", supportingLine: "y", whyDraft: "z" };
      },
    };
    const result = await generateDraftCopy(
      {
        brief,
        goalCents: 300000,
        catalog: STUB_CATALOG,
        skuIds: ["sku_donation"],
        timeoutMs: 10,
      },
      slow,
    );
    expect(result.copyStatus).toBe("fallback");
  });

  it("rejects forbidden phrases", async () => {
    const bad: LlmClient = {
      async generate() {
        return {
          headline: "Guaranteed $10k",
          supportingLine: "See https://evil.example",
          whyDraft: "low fee",
        };
      },
    };
    const result = await generateDraftCopy(
      {
        brief,
        goalCents: 300000,
        catalog: STUB_CATALOG,
        skuIds: ["sku_donation"],
      },
      bad,
    );
    expect(result.copyStatus).toBe("fallback");
  });

  it("fallbackCopy includes org name", () => {
    const copy = fallbackCopy(brief, 300000);
    expect(copy.headline).toContain("Lincoln VB");
  });

  it("formats the Program fallback without a possessive", async () => {
    const copy = await generateDraftCopy({
      brief: { ...brief, orgDisplayName: "Program", sport: "soccer" },
      goalCents: 100000,
      catalog: STUB_CATALOG,
      skuIds: ["sku_donation"],
    });
    expect(copy.headline).toContain("Our Program");
    expect(copy.headline).not.toMatch(/Program's/i);
    expect(copy.supportingLine).toMatch(/Our Program/i);
  });
});
