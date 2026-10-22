# Campaign Draft Agent — Design Spec

**Date:** 2026-10-22  
**Product:** White-label school/team fundraising platform (MoneyDolly-class)  
**Status:** Spec locked (brainstorm + CPO gap resolutions agreed 2026-10-22). Ready for implementation plan.

---

## 1. Verdict (why this exists)

A full “agentic product” with chat for coaches, students, and supporters is **not** needed and would hurt trust (fees and outreach are already the main complaint themes in this market).

**What is worth building:** a **director-facing Campaign Draft Assistant** that cuts campaign-setup time. Rules set the numbers; a model writes copy only. The director always publishes.

**Effectiveness:** high if it saves a fundraising director 15–30 minutes per campaign and increases campaigns per director. Low if it becomes a chat sidebar or auto-sends messages.

**Client willingness:** operators will like AI that drafts for their staff. Coaches and parents will not want AI that messages students’ contacts or moves money. Keep AI off supporter and participant surfaces in v1.

**Monetization:** included in **operator SaaS (Tier 2+)**, not a separate add-on and not a demo-only feature. It is a sales/retention wedge (“directors launch faster”). LLM and engineering cost sit in COGS/ops. Revisit a paid seat add-on only if operators demand paywalling.

---

## 2. Scope

### In scope (v1)

- Audience: **campaign director / operator staff** only
- Job: draft a campaign from a short brief (cold start: no past-campaign history)
- UI: brief form → **edit left / supporter preview right (layout B)** → Publish
- Preview must show fee transparency: sample supporter pays vs **program receives** (goal credit); shipping/fees called out as not counting toward the goal
- Rules engine: goal, SKU selection, surface order
- **Operator-editable sport presets** (first-class config, versioned)
- LLM: headline, supporting line, “why this draft” note only
- Note-based filters: **best-effort keyword rules only** (not NLP), with honest UI labeling
- Persist `CampaignDraft`; Publish creates a real `Campaign` via the same path as manual create

### Out of scope (v1)

- Chat UI of any kind
- Coach-facing or student-facing agents
- Auto-send SMS/email to contacts
- Refunds, payouts, Stripe actions
- Order-exception agent
- Fanbase / year-round microsite agent
- Using past campaigns as input
- Per-operator branded app shells for the draft UI
- Magic NLP understanding of free-text notes
- Separate SKU for this feature

---

## 3. User flow

1. Director opens **New campaign** → Brief form (sport, window, roster size, free-text note).
2. Clicks **Draft campaign**.
3. System validates brief → loads operator sport preset → runs rules (incl. keyword note filters) → calls copy generator → saves `CampaignDraft` with `preset_version`.
4. Review screen (B): left editable fields, right live supporter-page preview (no checkout) **including program-receives sample**.
5. If note filter applied or not: show label e.g. “Price filter: under $25” or “No price filter detected.”
6. Director edits any field; preview updates.
7. **Publish** creates `Campaign` + `CampaignOffer` rows and marks draft `published`.
8. Director continues with normal roster / launch (unchanged).

---

## 4. Architecture

Sits inside the white-label **modular monolith** as module `CampaignDraft`. Not a separate microservice.

```
BriefForm → POST /drafts
  → SportPresets (operator-editable, versioned)
  → DraftRulesEngine (deterministic + keyword note filters)
  → DraftCopyGenerator (LLM, no tools)
  → CampaignDraft row (status=draft)
→ DraftReviewSplit (B) + fee-transparent SupporterPagePreview
→ POST /drafts/:id/publish
  → existing Campaign create API
```

### Hard boundaries

- Model never calls Stripe, SMS, email, contact import, or catalog writes.
- Rules never invent SKUs outside `OperatorCatalog`.
- Draft never auto-publishes.
- If the model fails or times out: keep rule outputs; set `copy_status=fallback`; show placeholder copy and “copy unavailable — edit before publish.”

---

## 5. Components

### UI (director console)

| Component | Responsibility |
|---|---|
| `BriefForm` | Sport, dates, roster size, note, Draft button |
| `DraftReviewSplit` | Layout B: edit pane + preview pane |
| `SupporterPagePreview` | Read-only campaign page from draft fields; **must show sample “supporter pays / program receives”**; no live checkout |
| `NoteFilterBadge` | Shows detected keyword filter or “No price filter detected” |
| `PublishBar` | Back to brief, Publish |
| `SportPresetAdmin` | Operator admin: edit $/player, tags, min/max goal, default surface order |

### Backend

| Unit | Responsibility |
|---|---|
| `CampaignDraftService` | createDraft, updateDraft, publishDraft |
| `DraftRulesEngine` | goal_cents, sku_ids, surface_order, why_rules, note_filter_result |
| `DraftCopyGenerator` | LLM → headline, supporting_line, why_draft |
| `SportPresetService` | CRUD presets per operator; platform defaults; version bump on change |
| `NoteKeywordFilter` | Parse `under $N` / `max $N` / simple tag exclusions; return structured result or none |

---

## 6. Data model

### `SportPreset`

| Field | Notes |
|---|---|
| `id`, `operator_id` | Null `operator_id` = platform default |
| `sport_key`, `display_name` | e.g. `volleyball` |
| `dollars_per_player_cents` | Used in goal math |
| `min_goal_cents`, `max_goal_cents` | Optional clamps |
| `default_product_tags` | string[] |
| `default_surface_order` | `shop_first` \| `donate_first` |
| `version` | Increments on edit |
| `updated_at`, `updated_by` | Audit |

Operators review presets once per season before peak. Platform ships global defaults; operators override.

### `CampaignDraft`

| Field | Notes |
|---|---|
| `id`, `operator_id`, `org_id`, `created_by` | Tenant + author |
| `brief_json` | Sport, window, roster_size, note |
| `preset_id`, `preset_version` | Snapshot of preset used |
| `goal_cents` | From rules; editable |
| `surface_order` | `shop_first` \| `donate_first` |
| `sku_ids` | From rules; editable subset of operator catalog |
| `note_filter_json` | `{ type, amount_cents?, label }` or `{ type: "none" }` |
| `headline`, `supporting_line`, `why_draft` | From model or fallback |
| `copy_status` | `ok` \| `fallback` \| `failed` |
| `status` | `draft` \| `published` \| `discarded` |
| `campaign_id` | Set on publish |
| `goal_at_publish_cents` | Snapshot for quality metrics |
| `created_at`, `updated_at` | |

RLS: scoped by `operator_id` (and org membership for directors).

### APIs

- `POST /drafts` — create from brief  
- `GET /drafts/:id` — load review  
- `PATCH /drafts/:id` — director edits  
- `POST /drafts/:id/publish` — create Campaign + offers; idempotent if already published  
- `GET/PUT /operators/:id/sport-presets` — operator admin  

---

## 7. Rules engine (deterministic)

Inputs: brief + operator catalog + `SportPreset` (resolved version) + fee/price floors.

Outputs:

1. **Goal:** `roster_size × dollars_per_player_cents` for that sport. Clamp to preset min/max if present.
2. **Note filter (keyword only):** detect patterns such as `under $N`, `max $N`, `no apparel`. If none match → `note_filter.type = none` and do not invent a filter. Never claim the system “understood” the note.
3. **SKUs:** from `OperatorCatalog`, prefer preset tags; apply note filter if present; always include a donation-only line when mode allows products+donations; cap at 4–6 SKUs for v1.
4. **Surface order:** preset default, overridden to `shop_first` if any product SKU selected.
5. **why_rules:** short human string explaining the arithmetic (not from the LLM).

No ML in this path. Presets are versioned config, not learned weights.

---

## 8. Copy generator (LLM)

**Input (structured):** org display name, sport, goal, window, selected SKU names (not costs), director note.  
**Output (JSON schema):** `{ headline, supporting_line, why_draft }`  
**Constraints:** no URLs, no fee claims, no “guaranteed” fundraising outcomes, max lengths enforced server-side.  
**Timeout:** fail soft to fallback templates.  
**Logging:** store prompt hash + model id + latency; do not store full student PII (brief should not include student names).

---

## 9. Fee transparency on preview (required)

`SupporterPagePreview` must show at least:

- Sample donation (e.g. $50): supporter pays → **program receives** (goal credit after donation take).
- Sample product: retail → **group credit toward goal**; shipping/tax labeled as not counting toward the goal.

This is a brand requirement, not polish. Fake checkout is fine; silent fees are not.

---

## 10. Error handling

| Case | Behaviour |
|---|---|
| Invalid brief | 400; stay on BriefForm with field errors |
| Empty catalog | Draft with donation-only; warn on review |
| No note filter matched | Proceed; badge “No price filter detected” |
| LLM timeout / invalid JSON | Fallback copy; `copy_status=fallback`; allow publish after director edit |
| Publish with empty headline | Block publish; require edit |
| Publish when draft already published | Return existing `campaign_id` (idempotent) |
| Cross-tenant draft access | 404 via RLS |

---

## 11. Testing

- **Presets:** operator override wins over platform default; version bumps on edit; draft stores version used.
- **Rules:** sport × roster → expected goal; keyword cap filters SKUs; unmatched note → no filter; empty catalog → donation only.
- **Copy generator:** schema validation; timeout → fallback; forbidden phrases rejected.
- **API:** create → patch → publish creates Campaign; double publish idempotent; RLS denies other operator.
- **UI:** BriefForm required fields; preview updates when left pane changes; preview shows program-receives; Publish disabled until headline non-empty; NoteFilterBadge states.

---

## 12. Success criteria (pilot KPIs)

Primary:

| Metric | Pilot target |
|---|---|
| Median minutes: brief → publish | ≤ 5 |
| Campaigns launched per director per week | +20% vs that director’s baseline |
| Share of publishes where \|goal change\| from draft &lt; 20% | ≥ 60% |

Secondary (monitor, do not game): discard rate, SKU edit rate, `copy_status=fallback` rate.

Hard requirements:

- Zero automated outreach or payment actions from this feature.
- Copy failure never blocks a draft with valid rules output.

---

## 13. Relationship to white-label plan

Implements a thin AI layer on top of Campaign / Catalog milestones in `moneydolly-whitelabel-build-plan.md`. Does **not** replace M0–M3.

**Attach point (locked):** **early M3** — after ~8–12 real SKUs exist in the operator catalog so rules pick real products. Do not build this after M1 alone (goal calculator + copy without catalog is a weak demo). Roster and full fulfillment may still be incomplete; catalog must not be.

---

## 14. Decisions log

| Topic | Decision |
|---|---|
| First agent owner | Campaign director |
| First task | Campaign setup draft |
| UI shape | Form then review; layout **B** (edit + preview) |
| Draft inputs | Cold: brief + catalog only |
| Draft production | Rules for numbers; model for copy only |
| Chat | None in v1 |
| Monetization | Included in Tier 2+ operator SaaS |
| Note parsing | Keyword rules only + honest badge |
| Sport presets | Operator-editable, versioned, season review |
| Preview fees | Required “program receives” samples |
| Build timing | Early M3 (real SKUs), not M1 |
| Pilot KPIs | Minutes ≤5; +20% campaigns/director/week; ≥60% goal edit &lt;20% |
