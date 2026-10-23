import { formatOrgForCopy } from "@/domain/campaign-draft/draft-copy-generator";

export const COPY_TIMEOUT_MS = 2500;

export const FORBIDDEN_COPY =
  /https?:\/\/|www\.|\bguaranteed\b|\bfee\b|\bfees\b|\bno-fee\b/i;

export interface GuardedCopy {
  headline: string;
  supportingLine: string;
  whyDraft: string;
  usedFallback: boolean;
  guardrailReason: string | null;
}

export interface CopyModel {
  generate(prompt: string, signal: AbortSignal): Promise<unknown>;
}

export interface CopyRequest {
  orgName: string;
  sport: string;
  goalCents: number;
  windowStart: string;
  windowEnd: string;
  whyRules: string;
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function goalLabel(goalCents: number): string {
  return (goalCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** "April 15, 2027". The end date stays true after the draft is published; a day count does not. */
export function formatWindowEnd(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function fundraiserHeadline(orgName: string, sport: string): string {
  const org = formatOrgForCopy(orgName);
  const sportTitle = titleCase(sport.trim());
  if (sportTitle && org.toLowerCase().includes(sportTitle.toLowerCase())) {
    return `Support ${org} Fundraiser`;
  }
  return sportTitle ? `Support ${org} ${sportTitle} Fundraiser` : `Support ${org} Fundraiser`;
}

export function goalByDateLine(goalCents: number, windowEnd: string): string {
  const goal = goalLabel(goalCents);
  const end = formatWindowEnd(windowEnd);
  return end ? `Help us reach our $${goal} goal by ${end}.` : `Help us reach our $${goal} goal.`;
}

export function whyWeAreRaising(orgName: string, sport: string): string {
  const org = formatOrgForCopy(orgName);
  const sportTitle = titleCase(sport.trim());
  const program =
    sportTitle && !org.toLowerCase().includes(sportTitle.toLowerCase()) ? `${org} ${sportTitle}` : org;
  return `Every gift helps ${program} cover the season.`;
}

function fallbackCopy(input: CopyRequest, reason: string): GuardedCopy {
  console.warn(`[copy-guardrail] ${reason}`);
  return {
    headline: fundraiserHeadline(input.orgName, input.sport),
    supportingLine: goalByDateLine(input.goalCents, input.windowEnd),
    whyDraft: `Fallback Copy Active: ${input.whyRules}`,
    usedFallback: true,
    guardrailReason: reason,
  };
}

function readPayload(
  raw: unknown,
): { headline: string; supportingLine: string; whyDraft: string } | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const headline = record.headline;
  const supportingLine = record.supportingLine;
  const whyDraft = record.whyDraft;
  if (
    typeof headline !== "string" ||
    typeof supportingLine !== "string" ||
    typeof whyDraft !== "string" ||
    !headline.trim() ||
    !supportingLine.trim() ||
    !whyDraft.trim()
  ) {
    return null;
  }
  return {
    headline: headline.trim(),
    supportingLine: supportingLine.trim(),
    whyDraft: whyDraft.trim(),
  };
}

class TemplateCopyModel implements CopyModel {
  async generate(prompt: string): Promise<unknown> {
    const data = JSON.parse(prompt) as { org: string; sport: string; goal: string; endsOn: string | null };
    return {
      headline: fundraiserHeadline(data.org, data.sport),
      supportingLine: data.endsOn
        ? `Help us reach our $${data.goal} goal by ${data.endsOn}.`
        : `Help us reach our $${data.goal} goal.`,
      whyDraft: whyWeAreRaising(data.org, data.sport),
    };
  }
}

export async function generateGuardedCopy(
  input: CopyRequest,
  model: CopyModel = new TemplateCopyModel(),
  timeoutMs: number = COPY_TIMEOUT_MS,
): Promise<GuardedCopy> {
  const org = formatOrgForCopy(input.orgName);
  const sport = titleCase(input.sport);
  const goal = goalLabel(input.goalCents);
  const prompt = JSON.stringify({
    org,
    sport,
    goal,
    endsOn: formatWindowEnd(input.windowEnd),
    whyRules: input.whyRules,
    constraints: "No URLs, no fee claims, no guaranteed outcomes.",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await model.generate(prompt, controller.signal);
    if (controller.signal.aborted) return fallbackCopy(input, "timeout");
    const parsed = readPayload(raw);
    if (!parsed) return fallbackCopy(input, "malformed_json");
    const combined = `${parsed.headline} ${parsed.supportingLine} ${parsed.whyDraft}`;
    if (FORBIDDEN_COPY.test(combined)) return fallbackCopy(input, "forbidden_phrase");
    return { ...parsed, usedFallback: false, guardrailReason: null };
  } catch {
    return fallbackCopy(input, controller.signal.aborted ? "timeout" : "malformed_json");
  } finally {
    clearTimeout(timer);
  }
}
