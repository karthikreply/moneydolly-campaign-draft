# Admin Template Studio Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Admin NL bar generates and publishes sport+theme+SKU packs into a platform/operator registry, with dual localStorage/SQLite persistence and a split inspector UI at `/admin/templates`.

**Architecture:** Deterministic `generateTemplatePack` → `DraftTemplatePack` → `PresetsAndCatalog` registry (seeds + published). UI `AdminTemplateStudio` + `/admin/templates`. Static demo uses localStorage; Node uses SQLite JSON blob table + API. BriefForm/theme lists read from registry.

**Tech Stack:** Next.js 15, TypeScript, Vitest, better-sqlite3 (server), localStorage (static).

**Spec:** `docs/superpowers/specs/2026-10-23-admin-template-studio-design.md`

## Global Constraints

- AAA contrast ≥ 7:1 for generated theme colors  
- Deterministic NL only (LLM-shaped interface)  
- Platform + operator publish scopes  
- Dual persist via `isStaticDemo`  
- Body ≥ 18px, targets ≥ 44px  

---

### Task 1: Domain — pack types, AAA palette, generateTemplatePack

**Files:**
- Create: `src/domain/admin/template-pack-types.ts`
- Create: `src/domain/admin/aaa-palette.ts`
- Create: `src/domain/admin/generate-template-pack.ts`
- Test: `tests/admin-generate-template-pack.test.ts`

- [ ] Failing tests for lacrosse example prompt (sport, min/max, 5 SKUs under $35, neon green AAA)
- [ ] Implement extractor + mint + AAA repair
- [ ] Tests pass; commit

### Task 2: PresetsAndCatalog registry

**Files:**
- Create: `src/domain/admin/presets-and-catalog.ts`
- Test: `tests/presets-and-catalog.test.ts`
- Modify: theme/sport/catalog consumers to resolve via registry helpers

- [ ] Registry with platform/operator layers, publish, resolveTheme/listSports/listCatalog
- [ ] Seed from existing THEME_PACKS / PLATFORM presets / STUB_CATALOG
- [ ] Tests for operator override wins; commit

### Task 3: Persistence + API + demo-client

**Files:**
- Modify: `src/db/schema.ts` — `template_packs` JSON blob table
- Create: `src/app/api/admin/templates/route.ts`
- Modify: `src/lib/demo-client.ts`, `src/lib/campaign-client.ts` (or `admin-client.ts`)
- Modify: memory store / service as needed for catalog merge

- [ ] GET list / POST publish / POST generate (optional server generate)
- [ ] localStorage key `md-presets-catalog-v1`
- [ ] Commit

### Task 4: AdminTemplateStudio UI + route

**Files:**
- Create: `src/components/AdminTemplateStudio.tsx`
- Create: `src/app/(studio)/admin/templates/page.tsx`
- Modify: `src/app/(studio)/layout.tsx` — Admin nav link
- Modify: `src/app/globals.css` — admin studio styles
- Modify: `src/components/BriefForm.tsx` — sports/themes/catalog from registry

- [ ] Split inspector + preview + publish
- [ ] Wire BriefForm to live registry
- [ ] Commit

### Task 5: Verify + Pages rebuild

- [ ] `npx vitest run` green
- [ ] `npx tsc --noEmit` green
- [ ] Smoke `/admin/templates` on dev server
- [ ] Push; GitHub Pages workflow picks up BriefForm registry if needed
