# Admin Template Studio — Design

**Date:** 2026-10-23  
**Status:** Approved in conversation; awaiting written-spec review before implementation plan  
**Repo:** `moneydolly-campaign-draft`

## Objective

Build an Admin Studio that lets platform / operator admins use natural language to generate, inspect, and publish white-label **template packs** (sport preset + theme pack + catalog SKUs) into a multi-tenant `PresetsAndCatalog` registry. Directors then see those packs in the campaign brief / agent flows.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Tenancy | **Both** — platform packs (`operatorId: null`) plus operator overrides (current OperatorSwitcher) |
| NL generation (v1) | **Deterministic** slot extraction that *feels* conversational; same `generateTemplatePack(prompt)` interface later swaps to LLM |
| Persistence | **Dual** — `localStorage` when `NEXT_PUBLIC_STATIC_DEMO=1` (GitHub Pages); SQLite (+ API) when Node server is running |
| Visual system | Executive cool-gray studio; AAA text contrast ≥ 7:1 on generated theme surfaces |
| Auth | None in v1 (demo); Admin nav is visible in studio chrome |

## Non-goals (v1)

- Real LLM calls  
- Multi-admin authentication / RBAC  
- Rich post-publish editor (republish with same key replaces)  
- Separate admin-only deployment  

## Data model

### Template pack (draft + published)

A pack is one bundle:

1. **Sport preset** — `sportKey`, `displayName`, `dollarsPerPlayerCents`, `minGoalCents`, `maxGoalCents`, `defaultProductTags`, `defaultSurfaceOrder`, `version`  
2. **Theme pack** — `key`, `name`, `description`, `copyTone`, `headlineVerb`, `productTags`, `colors` (accent, accentInk, background, backgroundAlt, ink, muted, panel, line); fonts use shared app face (`var(--font-grotesk)`)  
3. **Catalog SKUs** — 4–6 `product` rows with `retailCents`, `groupCreditCents`, `shipHandlingCents`, `tags` (sport / theme / `apparel` | `merch` | `gear`); shared donation SKU remains global  

### Registry: `PresetsAndCatalog`

- **Platform layer** — available to all operators  
- **Operator layer** — scoped to `operatorId` from the top-bar switcher  
- **Resolution for directors:** operator entry wins on same `sportKey` / theme `key`; else platform; else hard-coded seeds (`PLATFORM_DEFAULTS`, `THEME_PACKS`, `STUB_CATALOG`)  
- **Publish scope toggle:** Platform | This operator  

### AAA on generated colors

After minting a palette from color words, run the same contrast checks as `tests/contrast.test.ts` and darken/lighten until ink, muted, and accent clear **7:1** on background / backgroundAlt / panel; accentInk clears 7:1 on accent.

## Natural language pipeline

**Example prompt:**  
*Create a Spring Lacrosse template with neon green accents, min goal $2,000, max $8,000, and 5 branded merch items under $35.*

1. **Extract** — sport/program, theme adjectives, color words, min/max goals, SKU count, price cap, apparel/merch bias  
2. **Normalize** — new `sportKey` allowed (e.g. `lacrosse`); dollars → cents; “under $35” → retail cap  
3. **Mint** — theme name; palette + AAA repair; goal bounds; `$/player` from mid(min,max) ÷ typical roster (or sport default); 4–6 SKUs from merch templates under cap (~30–35% group credit)  
4. **Natural status** — short lines (“Got lacrosse · neon green · 5 items under $35”)  
5. **Gaps** — if sport or budget missing, one follow-up chip at a time (campaign-agent pattern)  

**API shape:** `generateTemplatePack(prompt: string, ctx: { operatorId }) → { pack: DraftTemplatePack, reply: string, suggestions: string[] }`  
Later: LLM implements the same contract.

## UI

- **Route:** `/admin/templates`  
- **Component:** `src/components/AdminTemplateStudio.tsx`  
- **Nav:** add **Admin** next to Agent / Brief in studio layout  

### Split layout

| Left — Inspector | Right — Live preview |
|------------------|----------------------|
| NL prompt + Generate | Mini Campaign Brief using draft theme/preset/SKUs |
| Scope: Platform / This operator | Swatches + sample headline |
| CSS custom properties dump | Goal bounds + $/player |
| JSON: preset + SKUs | Offer list with prices |
| Validation / AAA notes | |

### Actions

- **Generate** — fill inspector + preview  
- **Publish Template to Platform** — write into registry (respect scope); Brief/Agent pickers read registry  
- **Start over** — clear draft  

## Persistence wiring

| Mode | Storage |
|------|---------|
| Static demo (`NEXT_PUBLIC_STATIC_DEMO=1`) | `localStorage` key e.g. `md-presets-catalog-v1` |
| Node (`npm run dev` / Docker) | SQLite tables (or JSON blob table) + `/api/admin/templates` |

Mirror the existing `campaign-client` / `isStaticDemo` pattern so GitHub Pages and local server both work.

## Director impact

After publish:

- Theme picker and sport dropdown include the new pack  
- Rules engine can resolve the new `sportKey` preset and filter catalog by new tags  
- Agent dialog theme/sport aliases gain the new sport name where extraction allows  

## Success criteria

1. Admin can type the lacrosse example, see inspector JSON + CSS vars + live brief preview  
2. Publish (platform or operator) makes the pack selectable on `/drafts/new` in the same environment  
3. Generated theme passes AAA contrast tests  
4. Static GitHub Pages demo can generate + publish without a backend  
5. Vitest covers parser minting, AAA repair, and registry resolve (platform vs operator)  

## Open follow-ups (post-v1)

- LLM adapter behind `generateTemplatePack`  
- Edit / archive published packs  
- Admin auth  
