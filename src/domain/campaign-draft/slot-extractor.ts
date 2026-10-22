const SPORTS = ["volleyball", "basketball", "soccer", "general"] as const;

const THEMES: Array<[RegExp, string]> = [
  [/spirit week/i, "spirit_week"],
  [/spring classic/i, "spring_classic"],
  [/championship/i, "championship_push"],
  [/night lights/i, "night_lights"],
  [/classic season/i, "classic_season"],
  [/community|charity|cause/i, "community"],
];

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

const ORG_STOP = new Set(["the", "our", "a", "an", "for", "draft", "my"]);

export interface ExtractedSlots {
  sport?: string;
  rosterSize?: number;
  orgDisplayName?: string;
  themeKey?: string;
  windowStart?: string;
  windowEnd?: string;
  /** True only when the utterance named an end date. A start-only date stays false. */
  windowEndMentioned?: boolean;
  note?: string;
}

export const DEFAULT_WINDOW_DAYS = 14;

export function todayIsoUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive span: a 14-day window starting March 15 ends March 28. */
export function inclusiveWindowEnd(startIso: string): string {
  return addUtcDays(startIso, DEFAULT_WINDOW_DAYS - 1);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** If that month/day is already before today's UTC midnight, use next year. */
function yearForMonthDay(month: number, day: number, now: Date): number {
  const today = todayIsoUtc(now);
  const year = Number(today.slice(0, 4));
  const candidate = isoDate(year, month, day);
  return candidate < today ? year + 1 : year;
}

export function extractBriefSlots(text: string, now: Date = new Date()): ExtractedSlots {
  const slots: ExtractedSlots = {};

  const sportMatch = text.match(
    new RegExp(String.raw`\b(${SPORTS.join("|")})\b`, "i"),
  );
  if (sportMatch) slots.sport = sportMatch[1].toLowerCase();

  const roster = text.match(/\b(\d+)\s+players\b/i);
  if (roster) slots.rosterSize = Number(roster[1]);

  if (slots.sport) {
    const org = text.match(
      new RegExp(String.raw`\b([A-Za-z][A-Za-z'&.\- ]{0,40}?)\s+${slots.sport}\b`, "i"),
    );
    if (org) {
      const name = org[1].replace(/[,]+$/g, "").trim();
      const first = name.split(/\s+/)[0]?.toLowerCase();
      if (name && first && !ORG_STOP.has(first)) slots.orgDisplayName = name;
    }
  }

  for (const [pattern, key] of THEMES) {
    if (pattern.test(text)) {
      slots.themeKey = key;
      break;
    }
  }

  const range = text.match(
    new RegExp(
      String.raw`\b(${MONTH_PATTERN})\s+(\d{1,2})\s+(?:to|through|-)\s+(${MONTH_PATTERN})\s+(\d{1,2})\b`,
      "i",
    ),
  );
  const startOnly = text.match(
    new RegExp(
      String.raw`\b(?:starting|starts|start|from|beginning)\s+(${MONTH_PATTERN})(?:\s+(\d{1,2}))?\b`,
      "i",
    ),
  );
  const bareDay = text.match(
    new RegExp(String.raw`\b(${MONTH_PATTERN})\s+(\d{1,2})\b(?!\s+(?:to|through|-))`, "i"),
  );
  const bareMonth = text.match(
    new RegExp(String.raw`\b(?:in|during)\s+(${MONTH_PATTERN})\b(?!\s+\d)`, "i"),
  );

  if (range) {
    const startMonth = MONTHS[range[1].toLowerCase()];
    const startDay = Number(range[2]);
    const endMonth = MONTHS[range[3].toLowerCase()];
    const endDay = Number(range[4]);
    const startYear = yearForMonthDay(startMonth, startDay, now);
    let endYear = startYear;
    const start = isoDate(startYear, startMonth, startDay);
    let end = isoDate(endYear, endMonth, endDay);
    if (end < start) end = isoDate(endYear + 1, endMonth, endDay);
    slots.windowStart = start;
    slots.windowEnd = end;
    slots.windowEndMentioned = true;
  } else if (startOnly || bareDay || bareMonth) {
    const source = startOnly ?? bareDay ?? bareMonth!;
    const month = MONTHS[source[1].toLowerCase()];
    const day = source[2] ? Number(source[2]) : 1;
    const year = yearForMonthDay(month, day, now);
    slots.windowStart = isoDate(year, month, day);
    slots.windowEnd = inclusiveWindowEnd(slots.windowStart);
    slots.windowEndMentioned = false;
  }

  const price = text.match(/\b(?:under|max)\s+\$\d+\b/i);
  const apparel = text.match(/\bno\s+apparel\b/i);
  if (price) slots.note = price[0];
  else if (apparel) slots.note = apparel[0];

  return slots;
}
