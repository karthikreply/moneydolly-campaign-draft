import { describe, expect, it } from "vitest";
import { defaultSeasonWindow } from "../src/domain/campaign-draft/season-window";

describe("defaultSeasonWindow", () => {
  it("rolls a finished spring to the next year", () => {
    expect(defaultSeasonWindow(new Date("2026-10-23T12:00:00Z"))).toEqual({
      windowStart: "2027-03-01",
      windowEnd: "2027-04-15",
    });
  });

  it("keeps this year while the season is still open", () => {
    expect(defaultSeasonWindow(new Date("2026-03-20T12:00:00Z"))).toEqual({
      windowStart: "2026-03-01",
      windowEnd: "2026-04-15",
    });
  });
});
