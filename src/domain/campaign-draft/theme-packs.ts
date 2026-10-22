export type ThemeKey =
  | "classic_season"
  | "spirit_week"
  | "spring_classic"
  | "championship_push"
  | "night_lights";

export interface CampaignThemePack {
  key: ThemeKey;
  name: string;
  description: string;
  /** Extra catalog tags preferred for this theme */
  productTags: string[];
  copyTone: string;
  headlineVerb: string;
  colors: {
    accent: string;
    accentInk: string;
    background: string;
    backgroundAlt: string;
    ink: string;
    muted: string;
    panel: string;
    line: string;
  };
  fonts: {
    display: string;
    body: string;
  };
}

export const THEME_PACKS: Record<ThemeKey, CampaignThemePack> = {
  classic_season: {
    key: "classic_season",
    name: "Classic season",
    description: "Clean team fundraiser look for the regular season.",
    productTags: ["merch", "gear"],
    copyTone: "straightforward, proud, community",
    headlineVerb: "Support",
    colors: {
      accent: "#064e38",
      accentInk: "#ffffff",
      background: "#e8f0eb",
      backgroundAlt: "#f4f7f5",
      ink: "#1a2332",
      muted: "#34424d",
      panel: "#ffffff",
      line: "#c9d5ce",
    },
    fonts: {
      display: '"Iowan Old Style", Palatino, Georgia, serif',
      body: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    },
  },
  spirit_week: {
    key: "spirit_week",
    name: "Spirit week",
    description: "Loud energy, apparel-forward, pep-rally vibe.",
    productTags: ["apparel", "spirit", "merch"],
    copyTone: "energetic, pep-rally, short punches",
    headlineVerb: "Show your spirit for",
    colors: {
      accent: "#7a2a12",
      accentInk: "#ffffff",
      background: "#fff1e6",
      backgroundAlt: "#ffe4cc",
      ink: "#2b1a0e",
      muted: "#4e3426",
      panel: "#fffaf5",
      line: "#e8c9b0",
    },
    fonts: {
      display: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
      body: '"Trebuchet MS", "Segoe UI", sans-serif',
    },
  },
  spring_classic: {
    key: "spring_classic",
    name: "Spring classic",
    description: "Fresh outdoor tournament weekend feel.",
    productTags: ["gear", "spring", "merch"],
    copyTone: "bright, outdoor, tournament weekend",
    headlineVerb: "Join",
    colors: {
      accent: "#184e34",
      accentInk: "#ffffff",
      background: "#eef6e8",
      backgroundAlt: "#e0efd6",
      ink: "#1e2f24",
      muted: "#314238",
      panel: "#fbfef8",
      line: "#c5d9b8",
    },
    fonts: {
      display: '"Georgia", "Times New Roman", serif',
      body: "Verdana, Geneva, sans-serif",
    },
  },
  championship_push: {
    key: "championship_push",
    name: "Championship push",
    description: "High-stakes end-of-season drive.",
    productTags: ["gear", "championship", "apparel"],
    copyTone: "urgent but respectful, finish-line focus",
    headlineVerb: "Help push",
    colors: {
      accent: "#1d3557",
      accentInk: "#f1faee",
      background: "#e8eef6",
      backgroundAlt: "#d6e0ef",
      ink: "#0d1b2a",
      muted: "#3a4556",
      panel: "#f7f9fc",
      line: "#b8c4d6",
    },
    fonts: {
      display: '"Arial Black", "Helvetica Bold", sans-serif',
      body: "Arial, Helvetica, sans-serif",
    },
  },
  night_lights: {
    key: "night_lights",
    name: "Night lights",
    description: "Evening game atmosphere — deep field, bright accents.",
    productTags: ["merch", "night", "apparel"],
    copyTone: "cinematic, under-the-lights, local pride",
    headlineVerb: "Light up",
    colors: {
      accent: "#f4d35e",
      accentInk: "#1a1a1a",
      background: "#1b2430",
      backgroundAlt: "#243041",
      ink: "#f0f3f7",
      muted: "#d5dde8",
      panel: "#222c3a",
      line: "#3a4658",
    },
    fonts: {
      display: '"Segoe UI Semibold", "Helvetica Neue", sans-serif',
      body: '"Segoe UI", Tahoma, sans-serif',
    },
  },
};

export const THEME_LIST = Object.values(THEME_PACKS);

export function resolveThemePack(key: string | undefined | null): CampaignThemePack {
  if (key && key in THEME_PACKS) {
    return THEME_PACKS[key as ThemeKey];
  }
  return THEME_PACKS.classic_season;
}

export function isThemeKey(value: string): value is ThemeKey {
  return value in THEME_PACKS;
}
