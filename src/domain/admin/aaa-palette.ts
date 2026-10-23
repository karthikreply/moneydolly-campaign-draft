import type { CampaignThemePack } from "../campaign-draft/theme-packs";

/** WCAG 2.2 relative luminance — same math as tests/contrast.test.ts */
export function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AAA = 7;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function adjustLightness(hex: string, delta: number): string {
  const [r, g, b] = parseHex(hex);
  const scale = 1 + delta;
  return toHex(r * scale, g * scale, b * scale);
}

function darkenUntilContrast(fg: string, bg: string, minRatio: number): string {
  let current = fg;
  for (let i = 0; i < 48; i++) {
    if (contrast(current, bg) >= minRatio) return current;
    current = adjustLightness(current, -0.06);
  }
  return current;
}

function lightenUntilContrast(fg: string, bg: string, minRatio: number): string {
  let current = fg;
  for (let i = 0; i < 48; i++) {
    if (contrast(current, bg) >= minRatio) return current;
    current = adjustLightness(current, 0.06);
  }
  return current;
}

export interface ColorHint {
  family: "green" | "blue" | "red" | "orange" | "purple" | "teal" | "neutral";
  neon?: boolean;
}

const COLOR_WORDS: { pattern: RegExp; hint: ColorHint }[] = [
  { pattern: /\bneon\s+green\b/i, hint: { family: "green", neon: true } },
  { pattern: /\bgreen\b/i, hint: { family: "green" } },
  { pattern: /\bneon\b/i, hint: { family: "green", neon: true } },
  { pattern: /\bblue\b/i, hint: { family: "blue" } },
  { pattern: /\bred\b|\bmaroon\b/i, hint: { family: "red" } },
  { pattern: /\borange\b/i, hint: { family: "orange" } },
  { pattern: /\bpurple\b|\bviolet\b/i, hint: { family: "purple" } },
  { pattern: /\bteal\b|\bturquoise\b/i, hint: { family: "teal" } },
];

export function extractColorHint(prompt: string): ColorHint {
  for (const { pattern, hint } of COLOR_WORDS) {
    if (pattern.test(prompt)) return hint;
  }
  return { family: "neutral" };
}

const BASE: Record<ColorHint["family"], { accent: string; bg: string; bgAlt: string; panel: string }> = {
  green: {
    accent: "#16a34a",
    bg: "#e8f5ec",
    bgAlt: "#f0faf3",
    panel: "#ffffff",
  },
  blue: {
    accent: "#1d4ed8",
    bg: "#e8eef8",
    bgAlt: "#f2f6fc",
    panel: "#ffffff",
  },
  red: {
    accent: "#b91c1c",
    bg: "#faeaea",
    bgAlt: "#fdf3f3",
    panel: "#ffffff",
  },
  orange: {
    accent: "#c2410c",
    bg: "#fff1e6",
    bgAlt: "#ffe8d6",
    panel: "#fffaf5",
  },
  purple: {
    accent: "#7e22ce",
    bg: "#f3ebfa",
    bgAlt: "#f8f2fc",
    panel: "#ffffff",
  },
  teal: {
    accent: "#0f766e",
    bg: "#e6f5f3",
    bgAlt: "#eefaf8",
    panel: "#ffffff",
  },
  neutral: {
    accent: "#064e38",
    bg: "#e8f0eb",
    bgAlt: "#f4f7f5",
    panel: "#ffffff",
  },
};

export function mintAaaPalette(hint: ColorHint): CampaignThemePack["colors"] {
  const base = { ...BASE[hint.family] };
  if (hint.neon && hint.family === "green") {
    base.accent = "#22c55e";
  }

  let ink = "#1a2332";
  let muted = "#34424d";
  let line = adjustLightness(base.accent, 0.55);
  const surfaces = [base.bg, base.bgAlt, base.panel];

  let accent = base.accent;
  for (const surface of surfaces) {
    accent = darkenUntilContrast(accent, surface, AAA);
    ink = darkenUntilContrast(ink, surface, AAA);
    muted = darkenUntilContrast(muted, surface, AAA);
  }

  let accentInk = "#ffffff";
  accentInk = contrast(accentInk, accent) >= AAA ? accentInk : "#0a0a0a";
  accentInk = contrast(accentInk, accent) >= AAA ? accentInk : darkenUntilContrast("#ffffff", accent, AAA);

  if (contrast(accentInk, accent) < AAA) {
    accentInk = lightenUntilContrast("#000000", accent, AAA);
  }

  return {
    accent,
    accentInk,
    background: base.bg,
    backgroundAlt: base.bgAlt,
    ink,
    muted,
    panel: base.panel,
    line,
  };
}

export function paletteMeetsAaa(colors: CampaignThemePack["colors"]): boolean {
  const surfaces = [colors.background, colors.backgroundAlt, colors.panel];
  for (const surface of surfaces) {
    if (contrast(colors.ink, surface) < AAA) return false;
    if (contrast(colors.muted, surface) < AAA) return false;
    if (contrast(colors.accent, surface) < AAA) return false;
  }
  return contrast(colors.accentInk, colors.accent) >= AAA;
}
