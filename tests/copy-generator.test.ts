import { describe, expect, it, vi } from "vitest";
import {
  COPY_TIMEOUT_MS,
  FORBIDDEN_COPY,
  generateGuardedCopy,
  type CopyModel,
} from "../src/lib/copyGenerator";

const brief = {
  orgName: "Lincoln",
  sport: "volleyball",
  goalCents: 270000,
  windowStart: "2027-03-01",
  windowEnd: "2027-03-14",
  whyRules: "Goal = 18 players × $150/player.",
};

describe("generateGuardedCopy", () => {
  it("uses a 2500ms abort timeout", () => {
    expect(COPY_TIMEOUT_MS).toBe(2500);
  });

  it("returns model copy when the guardrail passes", async () => {
    const model: CopyModel = {
      async generate() {
        return {
          headline: "Rally for Lincoln",
          supportingLine: "Shop or donate this season.",
          whyDraft: "Drafted from the brief.",
        };
      },
    };
    const copy = await generateGuardedCopy(brief, model);
    expect(copy.usedFallback).toBe(false);
    expect(copy.guardrailReason).toBeNull();
    expect(copy.headline).toBe("Rally for Lincoln");
  });

  it("falls back when the copy trips the forbidden-phrase regex", async () => {
    const model: CopyModel = {
      async generate() {
        return {
          headline: "Guaranteed results",
          supportingLine: "Visit www.example.com for no-fee gifts",
          whyDraft: "low fees",
        };
      },
    };
    const copy = await generateGuardedCopy(brief, model);
    expect(copy.usedFallback).toBe(true);
    expect(copy.guardrailReason).toBe("forbidden_phrase");
    expect(copy.headline).toBe("Support Lincoln Volleyball Fundraiser");
    expect(copy.supportingLine).toBe("Help us reach our $2,700 goal by March 14, 2027.");
    expect(copy.whyDraft).toBe(`Fallback Copy Active: ${brief.whyRules}`);
    expect(FORBIDDEN_COPY.test(`${copy.headline} ${copy.supportingLine} ${copy.whyDraft}`)).toBe(
      false,
    );
  });

  it("falls back on malformed JSON", async () => {
    const model: CopyModel = {
      async generate() {
        return "not-json";
      },
    };
    const copy = await generateGuardedCopy(brief, model);
    expect(copy.usedFallback).toBe(true);
    expect(copy.guardrailReason).toBe("malformed_json");
  });

  it("aborts a hung model at the timeout", async () => {
    const model: CopyModel = {
      async generate(_prompt, signal) {
        await new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      },
    };
    const copy = await generateGuardedCopy(brief, model, 30);
    expect(copy.usedFallback).toBe(true);
    expect(copy.guardrailReason).toBe("timeout");
  });

  it("names the sport once and dates the goal when the org already includes it", async () => {
    const copy = await generateGuardedCopy({
      ...brief,
      orgName: "Lincoln Volleyball",
    });
    expect(copy.headline).toBe("Support Lincoln Volleyball Fundraiser");
    expect(copy.supportingLine).toBe("Help us reach our $2,700 goal by March 14, 2027.");
    expect(copy.whyDraft).toBe("Every gift helps Lincoln Volleyball cover the season.");
  });

  it("formats Program without a possessive", async () => {
    const model: CopyModel = {
      async generate() {
        return { nope: true };
      },
    };
    const copy = await generateGuardedCopy({ ...brief, orgName: "Program", sport: "soccer" }, model);
    expect(copy.headline).toBe("Support Our Program Soccer Fundraiser");
    expect(copy.headline).not.toMatch(/Program's/);
  });
});

describe("hydrateIntent", () => {
  it("blocks sport plus roster and labels the missing anchors", async () => {
    const { hydrateIntent } = await import("../src/lib/hydrateIntent");
    const intent = hydrateIntent("volleyball eighteen players");
    expect(intent.score).toBeCloseTo(0.55);
    expect(intent.canDraft).toBe(false);
    expect(intent.statusLabel).toBe("Completeness: 55% — Missing window, orgName, themePack");
  });

  it("rolls a past start date to 2027 against 22 Oct 2026 UTC", async () => {
    const { hydrateIntent } = await import("../src/lib/hydrateIntent");
    const intent = hydrateIntent(
      "Lincoln volleyball, eighteen players, starting March 15, spirit week",
    );
    expect(intent.canDraft).toBe(true);
    expect(intent.brief?.windowStart).toBe("2027-03-15");
    expect(intent.brief?.windowEnd).toBe("2027-03-28");
    expect(intent.defaultedFields).toContain("windowEnd");
  });
});
