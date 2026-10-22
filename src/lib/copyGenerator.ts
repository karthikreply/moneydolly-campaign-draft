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

function windowDayCount(start: string, end: string): number {
  if (!start || !end) return 14;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 14;
  return Math.round((to - from) / 86_400_000) + 1;
}

function fallbackCopy(input: CopyRequest, reason: string): GuardedCopy {
  console.warn(`[copy-guardrail] ${reason}`);
  const org = formatOrgForCopy(input.orgName);
  const sport = titleCase(input.sport);
  const goal = (input.goalCents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  const days = windowDayCount(input.windowStart, input.windowEnd);
  return {
    headline: `Support ${org} ${sport} Fundraiser`,
    supportingLine: `Help us reach our $${goal} goal in ${days} days!`,
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
    const data = JSON.parse(prompt) as { org: string; sport: string; days: number; goal: string };
    return {
      headline: `Support ${data.org} ${data.sport} Fundraiser`,
      supportingLine: `Help us reach our $${data.goal} goal in ${data.days} days!`,
      whyDraft: "Drafted from the brief. Edit before publish.",
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
  const goal = (input.goalCents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  const prompt = JSON.stringify({
    org,
    sport,
    goal,
    days: windowDayCount(input.windowStart, input.windowEnd),
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
