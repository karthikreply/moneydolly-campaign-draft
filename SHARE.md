# Share this demo with your team

## Primary link (GitHub Pages)

**https://karthikreply.github.io/moneydolly-campaign-draft/**

Static demo: data lives in each visitor’s browser (`localStorage`). A seeded **Lincoln Volleyball** campaign is created on first load so pay links work immediately.

| Path | What it is |
|------|------------|
| `/` | Persona chooser — start here |
| `/admin/templates/` | Host: chat with the template agent, ready-made templates, publish |
| `/agent/` | Campaign Manager: voice / chat campaign agent |
| `/drafts/new/` | Campaign Manager: brief form |
| `/student/` | Student: player app, personal goal, pay link |
| `/c/lincoln-volleyball/?op=apex` | Example team pay page |
| `/c/lincoln-volleyball/jordan-lee/?op=apex` | Example player pay page |

Switch **Apex / Victory** in the top bar for white-label fees.

Published campaigns you create in the agent or studio are visible **in that browser only** until you share the link with someone who has the same stored data (use the copy-link buttons after publish).

## Option B — Full SQLite + API (local or Render)

For persistent server-side storage, run locally (`npm run dev`) or deploy to Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/karthikreply/moneydolly-campaign-draft)

## Option C — Quick share from your laptop (temporary tunnel)

```powershell
npm run dev
# other terminal:
powershell -ExecutionPolicy Bypass -File scripts/share-demo.ps1
```

Copy the `https://….trycloudflare.com` URL from the script output.

## Source code

https://github.com/karthikreply/moneydolly-campaign-draft
