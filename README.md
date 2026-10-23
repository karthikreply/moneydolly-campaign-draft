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

## Share with product / team

**Live demo:** https://karthikreply.github.io/moneydolly-campaign-draft/

See **[SHARE.md](./SHARE.md)** for paths, localStorage behavior, and Render/tunnel options.

The demo opens on a persona chooser. Switch persona any time from the top bar.

| Persona | Surface | Path |
|---|---|---|
| **Host** | Admin: chat with the template agent, start from ready-made templates, publish | `/admin/templates/` |
| **Campaign Manager** | Agent (voice / chat) or the Brief form | `/agent/`, `/drafts/new/` |
| **Student** | Player app, personal goal, pay link | `/student/` |
| Supporter | Example pay page | `/c/lincoln-volleyball/?op=apex` |

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000. Temporary public URL: `npm run share` (needs `npm run dev` already up).

## Stack

Next.js 15 · TypeScript · Vitest · better-sqlite3 · Zod

Demo tenant: `op_demo` / `org_lincoln` (see `src/lib/service.ts`).
