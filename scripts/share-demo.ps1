# Starts a public Cloudflare quick tunnel to the local Next.js app on :3000.
# The URL works while this script (and npm run dev / npm start) stay running.

$ErrorActionPreference = "Stop"
$port = 3000

Write-Host "Checking http://localhost:$port ..."
try {
  $null = Invoke-WebRequest -UseBasicParsing "http://localhost:$port/" -TimeoutSec 5
} catch {
  Write-Host "App is not running. Start it first:"
  Write-Host "  npm run dev"
  exit 1
}

Write-Host ""
Write-Host "Opening a public tunnel. Share the https://*.trycloudflare.com URL below."
Write-Host "It ends when you stop this script, sleep the PC, or stop the app."
Write-Host ""

npx --yes cloudflared tunnel --url "http://localhost:$port"
