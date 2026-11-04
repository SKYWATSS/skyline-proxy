# Skyline — private web proxy

Skyline is a mobile-first (iPhone) web proxy site with tabs, back/forward/reload, bookmarks, history,
quick-link tiles, dark/light mode, fullscreen, "Add to Home Screen" support and a **proxy-engine picker**:

| Engine | How it runs | License | Status in testing |
|---|---|---|---|
| Ultraviolet (default) | service worker + bare-mux + epoxy over this server's `/wisp/` | MIT | ✅ example.com, DuckDuckGo, Wikipedia |
| Scramjet | service worker (`/sj/`) over `/wisp/` | AGPL-3.0 (repo LICENSE; npm says MIT) | ✅ example.com, DuckDuckGo, Wikipedia |
| Unblocker | server-side rewriting at `/unblocker/` | AGPL-3.0 | ✅ example.com (simple sites only) |
| GUST (Nautilus Labs) | static single-file app at `/gust/`, preset to use this server's `/wisp/` | AGPL-3.0 | ✅ example.com |
| DaydreamX (Night Network) | separate optional service (own origin) | AGPL-3.0 | ⚠️ UI loads, proxying failed in testing (upstream bugs) |

Searches go to DuckDuckGo through the selected engine (switchable to Brave/Wikipedia in Settings).

## Run locally
```bash
npm ci
ACCESS_PASSWORD=choose-one npm start      # http://localhost:8080
```
Env vars: `PORT` (8080), `ACCESS_PASSWORD` (optional login gate), `RATE_LIMIT` (req/min/IP, default 600),
`DAYDREAMX_URL` (URL of the optional DaydreamX service), `ALLOW_PRIVATE_IPS=1` (only for sandboxes whose DNS
returns private IPs — leave off in production; it blocks the proxy from reaching LAN / cloud-metadata addresses).

## Docker
```bash
ACCESS_PASSWORD=choose-one docker compose up -d --build                         # Skyline only
ACCESS_PASSWORD=choose-one docker compose --profile daydreamx up -d --build     # + DaydreamX on :8081
```

## Deploy from an iPhone (no PC needed)
Use the host's website in Safari, sign in with **GitHub**, and point it at a GitHub repo containing this folder.
1. Create a free GitHub account (personal email) → new **private** repo → upload these files (github.com "Add file → Upload files" works in Safari; upload the unzipped folder contents, *not* `node_modules`).
2. Pick a host:
   - **Render** (free web service, Docker): New → Blueprint → choose the repo (uses `render.yaml`). Set `ACCESS_PASSWORD`. Free instances sleep after ~15 min idle (first load ~1 min). WebSockets supported.
   - **Koyeb** (free tier, 1 small instance): Create Service → GitHub → builder *Dockerfile*, port 8080, health check `/healthz`, add env `ACCESS_PASSWORD`.
   - **Railway**: no permanent free tier (trial credit, then ~$5/mo — approximate). New Project → Deploy from GitHub repo.
   - **VPS** (most reliable, approx. $4–6/mo e.g. Hetzner, DigitalOcean; Oracle Cloud has an always-free VM): install Docker, `git clone`, `docker compose up -d --build`, put Caddy in front for HTTPS (service workers need HTTPS).
3. Open the https URL on the iPhone → Share → **Add to Home Screen**.

### Terms-of-service check (do this before deploying)
Several free hosts **prohibit proxy / VPN / "unblocker" services** in their acceptable-use policies (Render and Heroku-style
PaaS have historically listed them; Replit and Vercel ban them; Glitch removed proxies). Policies change — read the
host's current AUP. A private, password-protected instance for personal use is lower-risk, but a paid VPS is the
safest choice because most VPS providers only forbid abuse, not proxies. You are responsible for traffic sent through it.

## Licenses
This project bundles AGPL-3.0 components, so the combined project is AGPL-3.0 (see `LICENSE`, `LICENSES/`).
If you let other people use it over a network, you must offer them the source (e.g. link the GitHub repo).
GUST and DaydreamX are third-party projects; their licenses/attribution are kept unchanged. Local changes:
`engines/daydreamx/index.js` (works without `.git`) and `engines/daydreamx/srv/router.js` (suggestion API crash fix), marked "Skyline patch".
