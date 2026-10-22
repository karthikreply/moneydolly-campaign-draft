import type { CampaignBrief, CatalogSku, CopyResult, CopyStatus } from "./types";

export interface LlmCopyPayload {
  headline: string;
  supportingLine: string;
  whyDraft: string;
}

export interface LlmClient {
  generate(prompt: string): Promise<LlmCopyPayload>;
}

const FORBIDDEN = [/https?:\/\//i, /guaranteed/i, /\bfee\b/i, /\b%\b/];

const MAX = {
  headline: 80,
  supportingLine: 160,
  whyDraft: 200,
};

export function fallbackCopy(brief: CampaignBrief, goalCents: number): CopyResult {
  const goal = `$${(goalCents / 100).toLocaleString("en-US")}`;
  return {
    headline: `Help ${brief.orgDisplayName} hit ${goal}`,
    supportingLine: `Support our ${brief.sport} season — every gift moves the team closer to the goal.`,
    whyDraft: "Fallback copy used because AI copy was unavailable.",
    copyStatus: "fallback",
  };
}

function sanitize(payload: LlmCopyPayload): LlmCopyPayload | null {
  const fields = [payload.headline, payload.supportingLine, payload.whyDraft];
  if (fields.some((f) => !f || typeof f !== "string")) return null;
  if (fields.some((f) => FORBIDDEN.some((re) => re.test(f)))) return null;

  return {
    headline: payload.headline.trim().slice(0, MAX.headline),
    supportingLine: payload.supportingLine.trim().slice(0, MAX.supportingLine),
    whyDraft: payload.whyDraft.trim().slice(0, MAX.whyDraft),
  };
}

function buildPrompt(
  brief: CampaignBrief,
  goalCents: number,
  skuNames: string[],
): string {
  return JSON.stringify({
    org: brief.orgDisplayName,
    sport: brief.sport,
    goalCents,
    window: { start: brief.windowStart, end: brief.windowEnd },
    skus: skuNames,
    note: brief.note,
    constraints: "No URLs, no fee claims, no guaranteed outcomes.",
  });
}

/** Deterministic stub LLM for offline/pilot use. */
export class TemplateLlmClient implements LlmClient {
  async generate(prompt: string): Promise<LlmCopyPayload> {
    const data = JSON.parse(prompt) as {
      org: string;
      sport: string;
      goalCents: number;
    };
    const goal = `$${(data.goalCents / 100).toLocaleString("en-US")}`;
    return {
      headline: `Rally for ${data.org}`,
      supportingLine: `Our ${data.sport} program is raising ${goal} this season. Shop or donate to help.`,
      whyDraft: "Drafted from sport, goal, and selected offers — edit freely before publish.",
    };
  }
}

export async function generateDraftCopy(
  input: {
    brief: CampaignBrief;
    goalCents: number;
    catalog: CatalogSku[];
    skuIds: string[];
    timeoutMs?: number;
  },
  llm: LlmClient = new TemplateLlmClient(),
): Promise<CopyResult> {
  const timeoutMs = input.timeoutMs ?? 2500;
  const skuNames = input.catalog
    .filter((s) => input.skuIds.includes(s.id) && s.kind === "product")
    .map((s) => s.name);
  const prompt = buildPrompt(input.brief, input.goalCents, skuNames);

  try {
    const payload = await Promise.race([
      llm.generate(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ]);
    const clean = sanitize(payload);
    if (!clean) {
      return { ...fallbackCopy(input.brief, input.goalCents), copyStatus: "fallback" };
    }
    return { ...clean, copyStatus: "ok" satisfies CopyStatus };
  } catch {
    return fallbackCopy(input.brief, input.goalCents);
  }
}
