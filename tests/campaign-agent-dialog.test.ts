import { describe, expect, it } from "vitest";
import {
  agentStep,
  draftReadyReply,
  initialAgentState,
  type AgentDialogState,
} from "../src/domain/agent/campaign-agent-dialog";

const persona = { name: "Ace", operatorName: "Apex Youth Sports" };
const NOW = new Date("2026-10-22T00:00:00.000Z");

function run(lines: string[], start: AgentDialogState = initialAgentState()) {
  let state = start;
  const results = [];
  for (const line of lines) {
    const result = agentStep(state, line, persona, NOW);
    results.push(result);
    state = result.state;
  }
  return { state, results, last: results[results.length - 1] };
}

describe("campaign agent dialog", () => {
  it("drafts immediately from a complete one-breath brief", () => {
    const { last } = run(["Lincoln volleyball, 18 players, March 1 to April 15, spirit week"]);
    expect(last.action?.type).toBe("create_draft");
    if (last.action?.type !== "create_draft") throw new Error("no draft");
    expect(last.action.brief).toMatchObject({
      sport: "volleyball",
      rosterSize: 18,
      orgDisplayName: "Lincoln",
      themeKey: "spirit_week",
      windowStart: "2027-03-01",
      windowEnd: "2027-04-15",
    });
    expect(last.state.phase).toBe("review");
  });

  it("asks only for what is missing, in order, and reads bare numbers in context", () => {
    const { results, state } = run(["basketball"]);
    expect(results[0].state.asked).toBe("roster");
    expect(results[0].reply).toMatch(/how many players/i);

    const second = agentStep(state, "twelve", persona, NOW);
    expect(second.state.slots.rosterSize).toBe(12);
    expect(second.state.asked).toBe("window");
  });

  it("honours skip on secondary slots and drafts with locked defaults", () => {
    const { last, results } = run(["soccer", "20", "skip", "skip", "skip"]);
    expect(results[2].state.skipped).toEqual(["window"]);
    expect(last.action?.type).toBe("create_draft");
    if (last.action?.type !== "create_draft") throw new Error("no draft");
    expect(last.action.brief.orgDisplayName).toBe("Program");
    expect(last.action.brief.themeKey).toBe("classic_season");
    expect(last.action.brief.windowStart).toBe("2026-10-22");
    expect(last.action.brief.windowEnd).toBe("2026-11-04");
    expect(last.action.brief.defaultedFields).toEqual(
      expect.arrayContaining(["windowDays", "orgName", "themePack"]),
    );
  });

  it("captures an org name answered on its own and a loose theme word", () => {
    const { last } = run(["volleyball", "15", "starting November 1", "Riverside Tigers", "championship"]);
    expect(last.action?.type).toBe("create_draft");
    if (last.action?.type !== "create_draft") throw new Error("no draft");
    expect(last.action.brief.orgDisplayName).toBe("Riverside Tigers");
    expect(last.action.brief.themeKey).toBe("championship_push");
    expect(last.action.brief.windowStart).toBe("2026-11-01");
    expect(last.action.brief.windowEnd).toBe("2026-11-14");
  });

  it("maps sport aliases like hoops and treats unknown sports as general", () => {
    expect(run(["hoops"]).state.slots.sport).toBe("basketball");
    expect(run(["marching band"]).state.slots.sport).toBe("general");
  });

  it("never publishes without an explicit yes, and routes edit to the studio", () => {
    const { state } = run(["Lincoln volleyball, 18 players, March 1 to April 15, spirit week"]);
    const review = draftReadyReply(state, {
      id: "d1",
      headline: "Show your spirit for Lincoln",
      goalCents: 270000,
      skuIds: ["sku_donation", "sku_vb_tee"],
    });
    expect(review.reply).toMatch(/\$2,700/);
    expect(review.reply).toMatch(/1 product/);

    const unclear = agentStep(review.state, "hmm what do you think", persona, NOW);
    expect(unclear.action).toBeUndefined();

    const edit = agentStep(review.state, "let me edit it", persona, NOW);
    expect(edit.action).toEqual({ type: "open_studio", draftId: "d1" });

    const publish = agentStep(review.state, "yes publish it", persona, NOW);
    expect(publish.action).toEqual({ type: "publish", draftId: "d1" });
    expect(publish.state.phase).toBe("published");
  });

  it("start over resets from any phase", () => {
    const { state } = run(["volleyball", "15"]);
    const reset = agentStep(state, "start over", persona, NOW);
    expect(reset.action).toEqual({ type: "restart" });
    expect(reset.state.slots).toEqual({});
  });
});
