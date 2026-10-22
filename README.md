# Campaign Draft Agent

Director-facing campaign draft assistant for a MoneyDolly-class white-label fundraising platform.

Spec: `docs/superpowers/specs/2026-10-22-campaign-draft-agent-design.md` (also in catalyst-poc).  
Plan: `docs/superpowers/plans/2026-10-22-campaign-draft-agent.md`.

## What it does

1. Director fills a brief (sport, window, roster, note).
2. Rules engine sets goal + SKUs; keyword filter parses notes like `under $25`.
3. Copy generator drafts headline/supporting line (template LLM + fallback).
4. Layout B review: edit left, supporter preview with **program receives** right.
5. Publish creates `Campaign` + `CampaignOffer` rows (SQLite pilot store).

## Try the demo

| | |
|---|---|
| **Talk to the agent** | `/agent` |
| **Fill a brief** | `/drafts/new` |
| **Example pay page** | `/c/lincoln-high-basketball?op=apex` |

Switch **Apex / Victory** in the top bar to see white-label fees and branding.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000 → **Talk to the agent** or **Brief**.

## Host a shareable demo (always on)

This app needs a long-running Node process (SQLite). Deploy with Docker:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/karthikreply/moneydolly-campaign-draft)

1. Open the button above (or the [deploy link](https://render.com/deploy?repo=https://github.com/karthikreply/moneydolly-campaign-draft)).
2. Sign in to Render with GitHub and click **Apply**.
3. When the service is live, share the `*.onrender.com` URL with your team.

`Dockerfile` and `render.yaml` are already in the repo.

## Stack

Next.js 15 · TypeScript · Vitest · better-sqlite3 · Zod

Demo tenant: `op_demo` / `org_lincoln` (see `src/lib/service.ts`).
