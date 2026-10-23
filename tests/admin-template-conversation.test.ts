import { describe, expect, it } from "vitest";
import { generateTemplatePack } from "../src/domain/admin/generate-template-pack";
import {
  CAPABILITIES,
  composePrompt,
  interpretTemplateMessage,
  type TemplateSpec,
} from "../src/domain/admin/template-conversation";
import { personaForPath } from "../src/domain/personas";

const ctx = { operatorName: "Apex Youth Sports" };
const OPENER =
  "Create a Spring Lacrosse template with neon green accents, min goal $2,000, max $8,000, and 5 branded merch items under $35.";

function build(message: string, current: TemplateSpec | null) {
  const turn = interpretTemplateMessage(message, current, ctx);
  if (turn.type !== "build") throw new Error(`expected build for "${message}", got ${turn.type}`);
  return { turn, result: generateTemplatePack(turn.prompt) };
}

describe("Template Studio conversation", () => {
  it("rebuilds the opener exactly through the canonical sentence", () => {
    const { turn, result } = build(OPENER, null);
    expect(turn.fresh).toBe(true);
    expect(result.canPublish).toBe(true);
    expect(result.pack.theme.name).toBe("Spring Lacrosse");
    expect(result.pack.sportPreset.minGoalCents).toBe(200_000);
    expect(result.pack.sportPreset.maxGoalCents).toBe(800_000);
    expect(result.pack.catalogSkus).toHaveLength(5);
    expect(result.pack.catalogSkus.every((s) => s.retailCents <= 3500)).toBe(true);
  });

  it("applies follow-ups to the current pack and keeps everything else", () => {
    let spec = build(OPENER, null).turn.spec;

    const fall = build("Make it fall", spec);
    expect(fall.turn.changes).toEqual(["Season → Fall"]);
    expect(fall.result.pack.theme.name).toBe("Fall Lacrosse");
    expect(fall.result.pack.sportPreset.maxGoalCents).toBe(800_000);
    spec = fall.turn.spec;

    const navy = build("Try navy blue", spec);
    expect(navy.turn.changes).toEqual(["Colour → navy blue"]);
    spec = navy.turn.spec;

    const cap = build("Cap items at $25", spec);
    expect(cap.result.pack.catalogSkus.every((s) => s.retailCents <= 2500)).toBe(true);
    spec = cap.turn.spec;

    const six = build("Six items", spec);
    expect(six.result.pack.catalogSkus.length).toBeLessThanOrEqual(6);
    expect(six.turn.spec.count).toBe(6);
    spec = six.turn.spec;

    const goals = build("Goals between $3,000 and $10,000", spec);
    expect(goals.result.pack.sportPreset.minGoalCents).toBe(300_000);
    expect(goals.result.pack.sportPreset.maxGoalCents).toBe(1_000_000);
    expect(goals.result.pack.theme.name).toBe("Fall Lacrosse");

    const short = build("Goals $3k to $12k", goals.turn.spec);
    expect(short.result.pack.sportPreset.maxGoalCents).toBe(1_200_000);
  });

  it("counts kind-qualified items, e.g. 6 apparel items", () => {
    const { result } = build("Fall Football template with maroon accents, 6 apparel items under $45", null);
    expect(result.pack.catalogSkus).toHaveLength(6);
  });

  it("asks for a sport, then accepts one as a follow-up", () => {
    const first = build("Neon green, 5 items under $30", null);
    expect(first.result.canPublish).toBe(false);
    const second = build("For hockey", first.turn.spec);
    expect(second.result.canPublish).toBe(true);
    expect(second.result.pack.sportPreset.sportKey).toBe("hockey");
    expect(second.result.pack.catalogSkus.every((s) => s.retailCents <= 3000)).toBe(true);
  });

  it("routes publish, preview, reset, and help commands", () => {
    const spec = build(OPENER, null).turn.spec;
    expect(interpretTemplateMessage("Publish it for everyone", spec, ctx)).toEqual({ type: "publish", scope: "platform" });
    expect(interpretTemplateMessage("Publish just for us", spec, ctx)).toEqual({ type: "publish", scope: "operator" });
    expect(interpretTemplateMessage("publish for Apex", spec, ctx)).toEqual({ type: "publish", scope: "operator" });
    expect(interpretTemplateMessage("Show the theme contrast", spec, ctx)).toEqual({ type: "preview", tab: "tokens" });
    expect(interpretTemplateMessage("Show the director brief", spec, ctx)).toEqual({ type: "preview", tab: "brief" });
    expect(interpretTemplateMessage("Start over", spec, ctx)).toEqual({ type: "reset" });
    expect(interpretTemplateMessage("What can you do?", spec, ctx)).toEqual({ type: "help" });
    expect(interpretTemplateMessage("Lovely weather", spec, ctx)).toEqual({ type: "unknown" });
  });

  it("does not read 'this template' as a sport", () => {
    const spec = build(OPENER, null).turn.spec;
    const turn = interpretTemplateMessage("Make this template fall", spec, ctx);
    expect(turn.type).toBe("build");
    if (turn.type === "build") expect(turn.spec.sport).toBe("Lacrosse");
  });

  it("every advertised example is a working command", () => {
    const spec = build(OPENER, null).turn.spec;
    for (const group of CAPABILITIES) {
      for (const example of group.examples) {
        expect(interpretTemplateMessage(example, spec, ctx).type, example).not.toBe("unknown");
      }
    }
  });

  it("composes a readable sentence", () => {
    expect(
      composePrompt({
        sport: "Hockey",
        adjectives: ["winter"],
        color: "navy blue",
        minGoal: 3000,
        maxGoal: 12000,
        count: 4,
        kind: "gear",
        priceCap: 30,
      }),
    ).toBe("Winter Hockey template with navy blue accents, min goal $3,000, max $12,000, and 4 gear items under $30.");
  });
});

describe("Persona routing", () => {
  it("maps each surface to its persona", () => {
    expect(personaForPath("/admin/templates")?.id).toBe("host");
    expect(personaForPath("/agent")?.id).toBe("manager");
    expect(personaForPath("/drafts/new")?.id).toBe("manager");
    expect(personaForPath("/drafts/abc")?.id).toBe("manager");
    expect(personaForPath("/student")?.id).toBe("student");
    expect(personaForPath("/")).toBeNull();
  });
});
