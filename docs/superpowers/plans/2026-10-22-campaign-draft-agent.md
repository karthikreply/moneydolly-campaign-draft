# Campaign Draft Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a director-facing Campaign Draft Assistant (brief → rules+copy → layout B review with fee transparency → publish) as a standalone TypeScript app that can later drop into the white-label modular monolith.

**Architecture:** Next.js App Router app with domain modules under `src/domain/campaign-draft/`. Rules and keyword note filters are pure functions. Copy generator uses a pluggable LLM client with deterministic fallback templates. Persistence is SQLite via `better-sqlite3` for local pilot (swap to Postgres later). Stub operator catalog of 12 SKUs simulates early-M3 attach.

**Tech Stack:** TypeScript, Next.js 15 (App Router), React, Vitest, better-sqlite3, Zod.

## Global Constraints

- Audience: campaign director / operator staff only — no chat UI.
- Rules set numbers; LLM writes copy only; director always publishes.
- Model never calls Stripe, SMS, email, catalog writes.
- Note filters: keyword patterns only; badge must say “No price filter detected” when unmatched.
- Preview must show sample supporter pays vs program receives.
- Sport presets: operator-editable, versioned; draft stores `preset_version`.
- Monetization: Tier 2+ SaaS (no separate SKU in product).
- Attach assumption: stub catalog ≥8 real SKUs (early M3).

**Repo home:** `C:\Users\k.kalamohan\Projects\moneydolly-campaign-draft` (new project; not catalyst-poc).

---

## File Structure

```
moneydolly-campaign-draft/
  package.json
  tsconfig.json
  vitest.config.ts
  next.config.ts
  README.md
  src/
    domain/campaign-draft/
      types.ts
      note-keyword-filter.ts
      sport-presets.ts
      draft-rules-engine.ts
      draft-copy-generator.ts
      fee-preview.ts
      campaign-draft-service.ts
      stub-catalog.ts
    db/
      schema.ts
      client.ts
    app/
      layout.tsx
      page.tsx
      globals.css
      drafts/new/page.tsx
      drafts/[id]/page.tsx
      api/drafts/route.ts
      api/drafts/[id]/route.ts
      api/drafts/[id]/publish/route.ts
      api/sport-presets/route.ts
    components/
      BriefForm.tsx
      DraftReviewSplit.tsx
      SupporterPagePreview.tsx
      NoteFilterBadge.tsx
      PublishBar.tsx
  tests/
    note-keyword-filter.test.ts
    draft-rules-engine.test.ts
    draft-copy-generator.test.ts
    fee-preview.test.ts
    campaign-draft-service.test.ts
```

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `next.config.ts`, `README.md`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create directory and init**

```bash
mkdir C:\Users\k.kalamohan\Projects\moneydolly-campaign-draft
cd C:\Users\k.kalamohan\Projects\moneydolly-campaign-draft
git init
npm init -y
```

- [ ] **Step 2: Install deps**

```bash
npm install next@15 react@19 react-dom@19 zod better-sqlite3 uuid
npm install -D typescript @types/node @types/react @types/react-dom @types/better-sqlite3 @types/uuid vitest
```

- [ ] **Step 3: Write package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold moneydolly-campaign-draft Next.js app"
```

---

### Task 2: Types + stub catalog + sport presets

**Files:**
- Create: `src/domain/campaign-draft/types.ts`, `stub-catalog.ts`, `sport-presets.ts`
- Test: `tests/sport-presets.test.ts`

**Produces:**
- `resolveSportPreset(operatorId, sportKey, store) → SportPreset`
- `upsertSportPreset(...) → SportPreset` (bumps version)
- `STUB_CATALOG: CatalogSku[]` (≥8 SKUs with tags/prices)

- [ ] **Step 1: Write failing test for preset override + version bump**

```ts
import { describe, it, expect } from "vitest";
import { createPresetStore, resolveSportPreset, upsertSportPreset } from "../src/domain/campaign-draft/sport-presets";

describe("sport presets", () => {
  it("operator override wins and bumps version", () => {
    const store = createPresetStore();
    const first = upsertSportPreset(store, {
      operatorId: "op1",
      sportKey: "volleyball",
      displayName: "Volleyball",
      dollarsPerPlayerCents: 15000,
      defaultProductTags: ["volleyball"],
      defaultSurfaceOrder: "shop_first",
    });
    expect(first.version).toBe(1);
    const second = upsertSportPreset(store, {
      operatorId: "op1",
      sportKey: "volleyball",
      displayName: "Volleyball",
      dollarsPerPlayerCents: 17500,
      defaultProductTags: ["volleyball"],
      defaultSurfaceOrder: "shop_first",
    });
    expect(second.version).toBe(2);
    expect(resolveSportPreset(store, "op1", "volleyball").dollarsPerPlayerCents).toBe(17500);
  });
});
```

- [ ] **Step 2: Implement types, stub catalog (12 SKUs), presets; make test pass; commit**

---

### Task 3: Note keyword filter

**Files:**
- Create: `src/domain/campaign-draft/note-keyword-filter.ts`
- Test: `tests/note-keyword-filter.test.ts`

**Produces:** `parseNoteFilter(note: string): NoteFilterResult`

Patterns:
- `/under\s*\$?\s*(\d+)/i` → `{ type: "max_price", amountCents, label }`
- `/max\s*\$?\s*(\d+)/i` → same
- `/no\s+apparel/i` → `{ type: "exclude_tag", tag: "apparel", label }`
- else → `{ type: "none", label: "No price filter detected" }`

- [ ] **Step 1: Write tests for under $25, no apparel, unmatched**
- [ ] **Step 2: Implement; pass; commit**

---

### Task 4: Draft rules engine

**Files:**
- Create: `src/domain/campaign-draft/draft-rules-engine.ts`
- Test: `tests/draft-rules-engine.test.ts`

**Produces:**
```ts
runDraftRules(input: {
  brief: CampaignBrief;
  preset: SportPreset;
  catalog: CatalogSku[];
}): DraftRulesResult
```

Logic:
1. `goalCents = rosterSize * dollarsPerPlayerCents`, clamp min/max
2. Apply note filter to catalog
3. Prefer preset tags; include donation SKU; cap 4–6 product SKUs
4. surfaceOrder from preset / shop_first if products
5. whyRules string with arithmetic

- [ ] **Step 1: Tests for goal math, price filter, empty catalog → donation only, unmatched note**
- [ ] **Step 2: Implement; pass; commit**

---

### Task 5: Copy generator + fee preview

**Files:**
- Create: `draft-copy-generator.ts`, `fee-preview.ts`
- Test: `tests/draft-copy-generator.test.ts`, `tests/fee-preview.test.ts`

**Produces:**
- `generateDraftCopy(input, llm?: LlmClient): Promise<CopyResult>` — timeout → fallback; reject forbidden phrases
- `buildFeePreviewSamples(sku, feeBps): FeePreviewSample[]` — donation $50 and one product with program receives

Donation sample: supporter pays 5000¢; program receives `floor(5000 * (1 - feeBps/10000))`.
Product: retail + shipping; group credit = groupCreditCents; shipping not toward goal.

- [ ] **Step 1: Tests; implement fallback LLM; fee math; commit**

---

### Task 6: Persistence + CampaignDraftService

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `campaign-draft-service.ts`
- Test: `tests/campaign-draft-service.test.ts`

**Produces:**
- `createDraft`, `getDraft`, `updateDraft`, `publishDraft` (idempotent)
- Tables: `sport_presets`, `campaign_drafts`, `campaigns`, `campaign_offers`
- On publish: create Campaign + offers; set `campaign_id`, `goal_at_publish_cents`, status=published

- [ ] **Step 1: Service tests with temp SQLite file**
- [ ] **Step 2: Implement schema + service; pass; commit**

---

### Task 7: API routes

**Files:**
- Create: `src/app/api/drafts/route.ts`, `src/app/api/drafts/[id]/route.ts`, `src/app/api/drafts/[id]/publish/route.ts`, `src/app/api/sport-presets/route.ts`

- [ ] **Step 1: Wire POST/GET/PATCH/publish + presets GET/PUT using Zod validation**
- [ ] **Step 2: Manual smoke via curl or vitest fetch; commit**

---

### Task 8: Layout B UI

**Files:**
- Create: components + `src/app/drafts/new/page.tsx`, `src/app/drafts/[id]/page.tsx`

- [ ] **Step 1: BriefForm → POST /api/drafts → redirect to review**
- [ ] **Step 2: DraftReviewSplit with editable left, SupporterPagePreview + NoteFilterBadge + PublishBar right**
- [ ] **Step 3: Home page links to New campaign; commit**

---

### Task 9: Verification

- [ ] **Step 1: `npm test` — all green**
- [ ] **Step 2: `npm run build` — succeeds**
- [ ] **Step 3: Final commit + README usage**

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| Brief → draft → layout B → publish | 8 |
| Rules goal/SKUs/surface | 4 |
| Keyword note filters + badge | 3, 8 |
| Operator sport presets + version | 2, 6 |
| LLM copy + fallback | 5 |
| Fee transparency preview | 5, 8 |
| Idempotent publish | 6 |
| Early M3 stub catalog | 2 |
| No chat / no Stripe from model | Global + 5 |
