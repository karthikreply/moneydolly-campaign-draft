export type PersonaId = "host" | "manager" | "student";

export interface PersonaNavItem {
  href: string;
  label: string;
  /** Path prefixes that mark this item as the current page. */
  match: string[];
}

export interface Persona {
  id: PersonaId;
  /** Role name the client recognises. */
  name: string;
  /** Product surface the role uses. */
  surface: string;
  who: string;
  promise: string;
  canDo: string[];
  home: string;
  nav: PersonaNavItem[];
  banner: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "host",
    name: "Host",
    surface: "Admin",
    who: "Platform team",
    promise: "Describe a season in plain English. The agent builds the template every campaign starts from.",
    canDo: ["Build a sport, look, and catalog from one sentence", "Refine it by chatting", "Publish to every operator or one"],
    home: "/admin/templates",
    nav: [{ href: "/admin/templates", label: "Template Studio", match: ["/admin"] }],
    banner: "Host view: build a template by chatting, publish it, then switch to Campaign Manager to use it.",
  },
  {
    id: "manager",
    name: "Campaign Manager",
    surface: "Agent",
    who: "Coach or athletic director",
    promise: "Talk through the season. Rules set the goal and products, AI writes the words, you publish.",
    canDo: ["Launch a campaign by voice or chat", "Review the real supporter page", "Publish and share player links"],
    home: "/agent",
    nav: [
      { href: "/agent", label: "Agent", match: ["/agent"] },
      { href: "/drafts/new", label: "Brief", match: ["/drafts"] },
    ],
    banner: "Campaign Manager view: talk to the agent or fill the brief, publish, then switch to Student.",
  },
  {
    id: "student",
    name: "Student",
    surface: "User",
    who: "Player on the roster",
    promise: "Get guardian approval, pick five supporters, and share a personal pay link.",
    canDo: ["See a personal goal", "Unlock sharing with guardian consent", "Open the pay link supporters use"],
    home: "/student",
    nav: [{ href: "/student", label: "My fundraiser", match: ["/student"] }],
    banner: "Student view: this is the player's app. Open the pay link to see what supporters get.",
  },
];

export function findPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[1];
}

/** The persona is derived from the route so the switcher can never disagree with the page. */
export function personaForPath(pathname: string): Persona | null {
  for (const persona of PERSONAS) {
    if (persona.nav.some((item) => item.match.some((prefix) => pathname.startsWith(prefix)))) return persona;
  }
  return null;
}
