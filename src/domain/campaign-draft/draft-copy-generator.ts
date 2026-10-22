import { resolveThemePack } from "./theme-packs";
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

/** "Program" reads as "Our Program", never "Program's". */
export function formatOrgForCopy(name: string): string {
  if (name.trim().toLowerCase() === "program") return "Our Program";
  return name.trim();
}

export function fallbackCopy(brief: CampaignBrief, goalCents: number): CopyResult {
  const theme = resolveThemePack(brief.themeKey);
  const goal = `$${(goalCents / 100).toLocaleString("en-US")}`;
  const org = formatOrgForCopy(brief.orgDisplayName);
  const programLine =
    org === "Our Program"
      ? `Support Our Program ${brief.sport} fundraiser — every gift moves the team closer to ${goal}.`
      : `Support our ${brief.sport} ${theme.name.toLowerCase()} — every gift moves the team closer to ${goal}.`;
  return {
    headline: `${theme.headlineVerb} ${org}`,
    supportingLine: programLine,
    whyDraft: `Fallback copy (${theme.name} tone) — AI copy was unavailable.`,
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
  const theme = resolveThemePack(brief.themeKey);
  return JSON.stringify({
    org: formatOrgForCopy(brief.orgDisplayName),
    sport: brief.sport,
    goalCents,
    theme: {
      key: theme.key,
      name: theme.name,
      tone: theme.copyTone,
      headlineVerb: theme.headlineVerb,
    },
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
      theme: { name: string; tone: string; headlineVerb: string };
    };
    const goal = `$${(data.goalCents / 100).toLocaleString("en-US")}`;
    const org = data.org.trim().toLowerCase() === "program" ? "Our Program" : data.org;
    const supporting =
      org === "Our Program"
        ? `Support Our Program ${data.sport} fundraiser. Raising ${goal}. Shop or donate to help.`
        : `${data.theme.name}: our ${data.sport} program is raising ${goal}. Shop or donate to help.`;
    return {
      headline: `${data.theme.headlineVerb} ${org}`,
      supportingLine: supporting,
      whyDraft: `Drafted with ${data.theme.name} tone (${data.theme.tone}). Edit freely before publish.`,
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
