# Share this demo with your team

Pick one option.

## Option A — Always-on link (recommended)

Hosted on Render’s free Docker plan. Survives overnight; URL stays the same.

1. Open: https://render.com/deploy?repo=https://github.com/karthikreply/moneydolly-campaign-draft  
2. Sign in with GitHub → **Apply**.  
3. Wait for the first deploy (~5–10 minutes).  
4. Share the `https://moneydolly-campaign-draft.onrender.com` (or the URL Render shows).

Free Render services sleep after idle time; the first open after sleep can take ~30–60 seconds.

What to try:

| Path | What it is |
|------|------------|
| `/` | Director home |
| `/agent` | Voice / chat campaign agent |
| `/drafts/new` | Brief form |
| `/c/lincoln-high-basketball?op=apex` | Example supporter pay page |

Switch **Apex / Victory** in the top bar for white-label fees.

## Option B — Quick share from your laptop (temporary)

Works only while your PC is awake and the app is running.

```powershell
npm run dev
# other terminal:
powershell -ExecutionPolicy Bypass -File scripts/share-demo.ps1
```

Copy the `https://….trycloudflare.com` URL from the script output.

## Source code

https://github.com/karthikreply/moneydolly-campaign-draft
