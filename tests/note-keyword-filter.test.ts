import { describe, expect, it } from "vitest";
import { parseNoteFilter } from "../src/domain/campaign-draft/note-keyword-filter";

describe("parseNoteFilter", () => {
  it("detects under $25", () => {
    expect(parseNoteFilter("Keep items under $25 please")).toEqual({
      type: "max_price",
      amountCents: 2500,
      label: "Price filter: under $25",
    });
  });

  it("detects max $30", () => {
    expect(parseNoteFilter("max $30 merch")).toEqual({
      type: "max_price",
      amountCents: 3000,
      label: "Price filter: max $30",
    });
  });

  it("detects no apparel", () => {
    expect(parseNoteFilter("no apparel this year")).toEqual({
      type: "exclude_tag",
      tag: "apparel",
      label: "Filter: no apparel",
    });
  });

  it("returns honest none for unmatched notes", () => {
    expect(parseNoteFilter("Make it festive for spring")).toEqual({
      type: "none",
      label: "No price filter detected",
    });
  });
});
