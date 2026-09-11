# VITALOOP — Production Runbook

**This is the single source of truth for production access, real architecture,
and deployment.** Everything here was verified directly against the live
server on 2026-09-10/11, not copied from an older doc. Where an older doc
(`README.md`'s Deployment section, `DEPLOYMENT_RUNBOOK.md`,
`OPERATIONAL_MANUAL.md`) disagrees with this file, **this file wins** — see
[Deprecated Docs](#deprecated-docs) at the bottom for why they drifted.

If you're new here, read this top to bottom once. Section 2 (Real Architecture)
is the part that will save you the most time — it's not what the repo layout
suggests.

---

## 1. How to Get In

**Server:** `159.65.252.227` (DigitalOcean droplet, hostname `VITALOOP`, Ubuntu 22.04)

```bash
ssh -i ~/.ssh/softdab_new root@159.65.252.227
```

An SSH config alias `softdab-server` exists (`~/.ssh/config`) pointing at the
same host/key. **It has been intermittently unreachable (`Connection
refused` on port 22) for hours at a time** during this audit, with no
established cause — the plain `ssh -i ~/.ssh/softdab_new root@159.65.252.227`
form worked when the alias didn't, so prefer it if the alias fails; don't
assume the server is down just because port 22 refuses.

**GitHub:** `softdabtech/vitaloop` (this repo). Push to `main` — there is no
protected-branch workflow blocking direct pushes today.

**Production URLs:**

| URL | What it is |
|---|---|
| https://vitaloop.today | Main product (frontend) |
| https://api.vitaloop.today | Backend API |
| https://crm.vitaloop.today | CRM (practitioner/admin) |
| https://ua.vitaloop.today | Ukrainian-locale variant |
| https://staging-api.vitaloop.today | Staging backend |

The droplet also hosts unrelated third-party sites
(`dr-valentina-surgery.od.ua`, `sky.softdab.tech`, `softdab.tech`, and a
`softdab` app) — **don't touch their nginx configs, systemd units, or
`/var/backups/`, `/opt/`, `/root/` directories that aren't clearly VITALOOP's**
when working on this project.

---

## 2. Real Architecture (verified, not assumed)

The repo's own docs (and even `docker-compose.prod.yml`) imply a clean
"everything runs in Docker" picture. **The main site does not actually work
that way.** Here's what's really serving traffic, confirmed by reading the
live nginx configs and `ss -tlnp` on 2026-09-11:

```
                         ┌─────────────────────────────────────────┐
                         │         nginx on the HOST (not          │
                         │         containerized), one vhost       │
                         │         per (sub)domain                 │
                         └─────────────────────────────────────────┘
                                          │
      ┌───────────────────┬──────────────┼──────────────┬─────────────────────┐
      ▼                   ▼              ▼               ▼                     ▼
vitaloop.today      api.vitaloop      crm.vitaloop   ua.vitaloop      staging-api.vitaloop
      │                .today            .today         .today             .today
      │                   │                  │              │                  │
      ▼                   ▼                  ▼              ▼                  ▼
 root = static      proxy_pass to      proxy_pass to   proxy_pass to    proxy_pass to
 files served       127.0.0.1:8004     127.0.0.1:9099  api.vitaloop     127.0.0.1:8011
 DIRECTLY BY        = Docker           /5090 = CRM     .today directly  = systemd
 NGINX FROM         container          (.NET, systemd  (absolute URL    vitaloop-staging-
 /var/www/VITALOOP  "vitaloop-         unit             baked into the  api.service
 /frontend/dist     backend"                            built bundle)   (separate .venv,
                                                                         separate backend/
 + /api/v1/  →      THIS is the        + /api/v1/ →                    not this repo's
   dead path,       real, current        dead path,                    backend/)
   404s only        backend — the        404s only
   (see below)      P0–P5 work in        (see below)
                    this repo's
 + /api/stripe/     backend/ landed
   webhook →        here
   127.0.0.1:8004
   (Docker backend)
```

### The critical thing to internalize

**`docker-compose.prod.yml`'s `frontend` service (container `vitaloop-frontend`,
port 8080) builds successfully, runs, and reports healthy — and is
completely irrelevant to what `vitaloop.today` visitors see.** nginx serves
the site straight off `/var/www/VITALOOP/frontend/dist/` as static files. The
Docker frontend container is either a parallel migration-in-progress that
was never cut over, or leftover infrastructure. **Do not assume a frontend
fix has shipped because the Docker image and container look right — verify
against the actual served bundle** (see [Deploying the Frontend](#deploying-the-frontend)).

The **backend** story is the opposite and reassuring: `api.vitaloop.today`
(the domain the frontend's compiled JS actually calls —
`VITE_API_BASE_URL=https://api.vitaloop.today` is baked into the bundle,
confirmed by grepping the built JS) proxies straight to the Docker
`vitaloop-backend` container on :8004. **All the P0–P5 backend work in this
repo's `backend/` is live and does matter.**

There **was** also `/opt/analysis-service` — a different, older FastAPI
codebase (its `main.py` was structurally different from
`backend/app/main.py`) — running as a bare process on :8006 that
`ua.vitaloop.today` and `vitaloop.today`'s `/api/v1/` nginx `location`
pointed at. **Removed 2026-09-11** after confirming via nginx access logs
that every hit to `/api/v1/*` across 3+ weeks was a vulnerability scanner
probing for `.env`/`credentials`/`config` — zero legitimate traffic, ever
(the real frontend calls `api.vitaloop.today` directly, never the relative
`/api/v1/` path). The nginx `location /api/v1/` blocks on both vhosts still
exist and now proxy to nothing — harmless (scanners get connection-refused
instead of a 404) but worth deleting from the nginx configs next time
someone's editing them.

### Components at a glance

| Component | Where it runs | Managed by | What it does |
|---|---|---|---|
| Backend (current) | Docker container `vitaloop-backend`, :8004 | `docker-compose.prod.yml` | Real API behind `api.vitaloop.today` |
| Frontend (real) | Static files, `/var/www/VITALOOP/frontend/dist` | Host nginx reads it directly; built by `npm run build` **on the host** | What `vitaloop.today` visitors get |
| Frontend (Docker, unused) | Docker container `vitaloop-frontend`, :8080 | `docker-compose.prod.yml` | Healthy, built correctly, serves no real traffic |
| CRM | `.NET 8`, `/var/www/VITALOOP/crm-mvc/publish` | `systemd`: `vitaloop-crm-mvc.service` | Practitioner/admin app |
| Staging backend | `/opt/vitaloop-staging/backend`, own `.venv`, :8011 | `systemd`: `vitaloop-staging-api.service` | Staging environment |
| Stability monitor | `/opt/vitaloop-monitor/monitor.py`, bare system `python3` | `systemd`: `vitaloop-monitor.service` | Some kind of internal health polling (see [Monitoring](#4-monitoring--alerting)) |

---

## 3. Deploying

### Deploying the Backend (Docker — the correct, current path)

```bash
ssh -i ~/.ssh/softdab_new root@159.65.252.227
cd /var/www/VITALOOP
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.prod.yml build --no-cache backend
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
curl -s http://localhost:8004/health
```

Or, from your machine, use `scripts/deploy-docker.sh` — it does the above for
both backend and frontend images, plus a post-deploy health check. As of
2026-09-11 it also runs a landing-page image smoke check (see
[What Broke and Why](#5-what-broke-and-why-2026-09-10-11-incident-log)),
though that check only matters for the Docker frontend image, not the real
served site.

### Deploying the Frontend (the one that actually matters)

**The real, live site is built and served from the host filesystem, not a
container.** This is the only sequence that ships a frontend change to real
visitors:

```bash
ssh -i ~/.ssh/softdab_new root@159.65.252.227
cd /var/www/VITALOOP
git fetch origin main && git reset --hard origin/main
cd frontend
npm ci --prefer-offline --no-audit --legacy-peer-deps
NODE_OPTIONS='--max-old-space-size=2048' npm run build
```

That's it — nginx reads `frontend/dist/` on every request, no restart needed.
`frontend/.env.production` must exist on the host (it's git-ignored, holds
real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_API_BASE_URL`
etc. — see `frontend/.env.example` for the shape). If it's ever missing,
`npm run build` fails fast with "Missing required frontend env variables"
via `validate-env.mjs` — that's intentional, don't work around it by
weakening the check.

**If you also rebuild the Docker frontend image** (`vitaloop-frontend`
container), that's a separate, currently-cosmetic action — it keeps that
parallel infrastructure from silently rotting, but it is not how a frontend
change reaches production today. Don't confuse "Docker image built and
container healthy" with "shipped."

**Verify a frontend deploy actually landed** — don't trust `curl
vitaloop.today | grep 200`, the HTML shell doesn't change per-deploy in a way
that's visible. Instead resolve the real JS bundle and check content:

```bash
LANDING_JS=$(curl -s https://vitaloop.today/ | grep -oE '/assets/index-[A-Za-z0-9]+\.js' | head -1)
curl -s "https://vitaloop.today$LANDING_JS" | grep -oE 'Landing-[A-Za-z0-9]+\.js' | head -1
# then curl that Landing-*.js chunk and grep for whatever string you changed
```

Also clear the browser's PWA service worker cache when verifying visually —
this app registers one, and it will keep serving a stale bundle to your own
browser even after the server has the new one:

```js
// in browser devtools console
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const names = await caches.keys();
for (const n of names) await caches.delete(n);
location.reload();
```

### Deploying the CRM

```bash
ssh -i ~/.ssh/softdab_new root@159.65.252.227
cd /var/www/VITALOOP/crm-mvc
git fetch origin main && git reset --hard origin/main
dotnet publish -c Release -o publish
systemctl restart vitaloop-crm-mvc.service
curl -s https://crm.vitaloop.today/version
```

### CI/CD status: not actually deploying anything

`.github/workflows/ci-cd.yml` has a `deploy` job gated on
`backend-test`, `crm-test`, and `frontend-build` all passing. **As of
2026-09-10/11, all three of those consistently fail** (missing
`tests/test_billing_stripe.py`, a `.NET` static-web-assets build error, and a
frontend build step exiting 127), so `deploy` never runs. Every deploy done
during this audit was manual, via SSH, as documented above. Don't assume
pushing to `main` ships anything — it doesn't, right now. Fixing the CI
tests so `deploy` actually fires again is real, undone work; it's not in
scope here beyond flagging it.

---

## 4. Monitoring & Alerting

**There is no error-tracking service (Sentry or otherwise) watching this
app — deliberately, not as an oversight.** The `sentry_sdk` integration was
tried on 2026-09-11 (backend and frontend both had it wired up already) and
removed the same day at the owner's explicit call: Sentry's paid tiers are a
real cost this pre-revenue product shouldn't be carrying yet, and the
attempt itself surfaced a live bug — `backend/app/main.py`'s
`StarletteIntegration(failed_request_status_codes=...)` call is incompatible
with the pinned `sentry-sdk==1.44.1` (`TypeError: unexpected keyword
argument`), which took the backend down in a crash loop the moment a real
DSN was set. That code, the `sentry-sdk` dependency, `@sentry/react` on the
frontend, and every `settings.sentry_dsn` reference were all removed
afterward — there is no dormant/half-wired Sentry code left to trip over.
If this gets revisited later (Sentry's free tier is genuinely free — 5K
errors/month, no card required — or a self-hosted alternative like
GlitchTip), start from a clean re-add rather than assuming the old
integration still works; the version-compatibility bug above was never
fixed, only removed. Until then, whatever hasn't crash-looped hard enough to
trip the mechanisms below is invisible.

**What actually exists:**

1. **Email ops alerts** (`backend/app/services/ops_alerts.py`,
   `backend/app/middleware/ops_alerts.py`): sends an email (via Resend/
   SendGrid) to `ops_alert_email` (defaults to `info@softdab.tech`, not
   overridden in `.env`) when a request to a "critical path" prefix
   (`/auth`, `/analyze`, `/protocol`, `/admin`, etc. — see
   `CRITICAL_PREFIXES` in `ops_alerts.py`) returns HTTP 5xx, or when one of
   those raises an unhandled exception. **Capped at 2 emails/day**
   (`ops_alerts_max_emails_per_day`); beyond that it silently suppresses
   further alerts for the rest of the UTC day (logs a warning, sends
   nothing) — so a sustained incident past the second alert goes dark until
   the next day unless someone is watching logs directly.
   - **This only fires on HTTP-level failure.** A request that returns 200
     with silently wrong content — like the broken landing-page image paths
     found 2026-09-10 — triggers nothing. If you ship something that can
     "succeed" while being wrong, this alerting will not catch it; you need
     a content-level smoke check (see the image-URL check added to
     `scripts/deploy-docker.sh`).

2. **`vitaloop-monitor.service`** (`/opt/vitaloop-monitor/monitor.py`, bare
   system `python3`, not part of this repo): polls something and serves an
   HTTP status/dashboard/history/logs interface on :9099 that
   `crm.vitaloop.today`'s nginx config forwards `/dashboard`, `/status`,
   `/history`, `/logs` to. **Not audited in depth this session** — worth a
   follow-up pass to confirm what it actually watches and whether its
   alerts (if any) are configured to reach someone.

3. **Rate limiting** (`app/middleware/security.py`): protects `/auth`,
   `/analyze`, `/protocol` from abuse. It was **silently disabled** for an
   unknown period before 2026-09-11 — configured for a Redis backend
   (`RATE_LIMIT_BACKEND=redis`) with no Redis instance running anywhere on
   the box, so every check hit `Error 111 connection refused` and fell back
   open (`RateLimitDecision(limited=False)` — availability over protection,
   by design, but it means zero rate limiting was actually happening).
   **Fixed 2026-09-11** by switching `backend/.env` to
   `RATE_LIMIT_BACKEND=inmemory` — correct for this single-instance
   deployment; only worth revisiting if the backend is ever horizontally
   scaled (in-memory state wouldn't be shared across instances).

**Bottom line:** if you're debugging "why didn't we know about this
sooner," the answer is almost always "no error tracking, and the failure
didn't happen to be a 5xx on a critical path within the daily email cap."
That's a known, accepted tradeoff right now (see above), not a
misconfiguration — but it's still the single biggest blind spot in this
system, so don't assume something would have been caught just because it
looks like it should have been.

---

## 5. What Broke and Why (2026-09-10/11 incident log)

Keeping this here (not just in git log) because the failure modes are
non-obvious and will bite again if forgotten.

### The landing page images were broken for an unknown period

Two `<img>` paths on `vitaloop.today`'s landing page referenced filenames
that don't exist under `frontend/public/mockups/` (`dashboard-today.webp`,
`results-report.webp` — real files were named `results-clean.webp` and
`lab-results.webp`). HTTP 200 the whole time (SPA shell always loads fine),
so nothing in [Monitoring](#4-monitoring--alerting) caught it. Fixed by
correcting the paths in `LightHero.jsx` / `Landing.jsx` — but shipping that
one-line fix took most of a day, because of the next four bugs, all
compounding:

### `docker-compose.prod.yml`'s frontend volume mount shadowed every Docker build

```yaml
# REMOVED — do not re-add this:
volumes:
  - ./frontend/dist:/usr/share/nginx/html:ro
```

This is what made `docker build` + `docker compose up` look like it worked
(image built, container "started fine") while shipping nothing — the mount
silently overrode the image's `COPY --from=builder /app/dist ...` with
whatever was on the host at `frontend/dist`. Removed in commit `5027528f`.
**This is also unrelated to why the real site was unaffected by Docker
builds** — see [Section 2](#2-real-architecture-verified-not-assumed): the
real site was never reading from that container's output anyway. The volume
mount bug was real and worth fixing for the Docker frontend's own internal
consistency, but it was never the reason production stayed broken.

### An ARG-based env-var fix introduced a subtler bug

Tried adding `docker-compose.prod.yml` `build.args` for `VITE_*` secrets as
an explicit CI/CD-friendly path alongside the existing
`frontend/.env.production`-file convention. First attempt used plain
`ENV VITE_X=$VITE_X` in `Dockerfile.prod` — broke the build, because an
*unset* `ARG`, once declared, is injected as a real (empty-string)
environment variable into **every subsequent `RUN`** in that build stage,
and `validate-env.mjs` does `{...envFile, ...process.env}` — the empty
string silently wins over a correct, committed `.env.production`. Fixed
(commit `c3af279d`) by merging the write-guard and `npm run build` into one
`RUN`, ending with an explicit `unset` of all six ARG-derived vars in the
same shell, right before the build runs. Verified both with explicit empty
`--build-arg` values and with none at all.

### The frontend Docker container reported "unhealthy" nonstop

`FailingStreak: 1456` — `wget --spider http://localhost:80` failing with
"connection refused" from *inside a container serving 200s the whole time*.
Classic `/etc/hosts` ordering: `localhost` resolves to `::1` before
`127.0.0.1`, nginx only binds `0.0.0.0` (IPv4). Fixed (commit `998c359a`) by
pointing the `HEALTHCHECK` at `127.0.0.1` explicitly.

### Disk was at 89%, no one had noticed

`docker builder prune -af` reclaimed 3.5GB of build cache accumulated across
this audit's many rebuild attempts, taking it to 80%. **Still worth
periodic attention** — see [Known Tech Debt](#known-tech-debt).

### Two systemd units were failing silently: `certbot` and `logrotate`

Found while checking `systemctl` state as part of this audit — neither
alerts anywhere, so both had been broken for some time with nobody aware.

- **`certbot.service`**: `AttributeError: module 'lib' has no attribute
  'GEN_EMAIL'`. Root cause: something had run a bare, non-venv
  `pip install` at some point that put `cryptography==49.0.0` in
  `/usr/local/lib/python3.10/dist-packages` — Python's import path puts that
  ahead of the apt-managed `/usr/lib/python3/dist-packages`, so it silently
  shadowed the apt `python3-cryptography==3.4.8` that `python3-openssl`
  (certbot's dependency) actually needs. **This means SSL renewal had been
  broken system-wide** (not just for VITALOOP's certs) until fixed. Fixed by
  `pip3 uninstall cryptography` (confirmed nothing else on the box imports
  it directly outside each service's own `.venv`) — `certbot renew
  --dry-run` now succeeds for `vitaloop.today`, `staging-api.vitaloop.today`.
  (Three *unrelated* domains on this shared box — `dr-valentina-surgery.od.ua`,
  `sky.softdab.tech`, `softdab.tech` — still fail renewal for a different,
  unrelated reason; not investigated, not this project's concern.)
- **`logrotate.service`**: `/etc/logrotate.d/softdab` (custom config)
  duplicated the stock `/etc/logrotate.d/nginx` block for
  `/var/log/nginx/*.log` verbatim — logrotate refuses to run at all when it
  finds a duplicate target anywhere in `/etc/logrotate.d/`, so **no logs on
  the box had been rotating**. Removed the duplicate block from
  `/etc/logrotate.d/softdab`, leaving its two unique blocks intact.

Both `systemctl reset-failed` and re-verified clean — `systemctl list-units
--state=failed` reports nothing after the fix.

---

## Known Tech Debt

Found during this audit. Items marked **[Resolved 2026-09-11]** were acted on
the same day, after confirming (real nginx access logs, not just config
reads) that nothing legitimate depended on them; the rest are still flagged,
not fixed, pending an owner decision:

- **~~`/opt/analysis-service`~~ [Resolved 2026-09-11]**: confirmed dead via
  nginx access logs — every `/api/v1/*` hit across 3+ weeks of logs was a
  vulnerability scanner probing for `.env`/`credentials`/`config` (all
  404s), zero legitimate traffic. Process killed, directory removed
  (~1.5GB). `vitaloop.today` and `ua.vitaloop.today` still have a dead
  `/api/v1/` nginx `location` block proxying to a now-nothing port 8006 —
  harmless (scanners get a clean connection-refused instead of a 404) but
  could be deleted from the nginx configs too, next time someone's in there.
- **~~Accumulated deploy backups~~ [Resolved 2026-09-11]**: `/root/vitaloop-release-backups`
  pruned from 52 dated directories to the last 5; `/var/backups/vitaloop-*`
  pruned from years of accumulation to the last 3 files per category (or
  removed outright for single-file/one-off dirs). Freed ~3GB. No retention
  automation was added — this was a one-time manual prune, it will
  re-accumulate the same way if nothing changes upstream.
- **`docker-compose.prod.yml` frontend service**: builds correctly, runs
  healthy, serves zero real traffic. Either finish cutting the real site
  over to it, or stop maintaining it as if it matters.
- **CI/CD deploy job never runs** — three failing test/build steps block it
  (see [CI/CD status](#cicd-status-not-actually-deploying-anything)).
- **Disk usage**: after clearing 3.5GB of build cache plus the two items
  above, down to ~70% from 89% at the start of this audit. Still worth a
  recurring `docker builder prune` in the deploy script so it doesn't creep
  back — every rebuild during this audit added another gigabyte-plus of
  cache.
- **No error tracking (Sentry or otherwise)** — a deliberate call, not an
  oversight; see [Section 4](#4-monitoring--alerting) for the full story
  including the version-incompatibility bug that surfaced when it was
  briefly tried. Still the single biggest monitoring blind spot: everything
  else in this list was found by manual SSH archaeology, not by anything
  alerting on its own.

---

## Deprecated Docs

These describe an earlier or different deployment reality and should not be
followed for production ops. Not deleted (history has value), but do not
trust them over this file:

- **`README.md`**'s Deployment section — describes `scripts/deploy-prod.sh`
  building the frontend locally and `rsync`-ing `frontend/dist/` to the
  server. That's *closer* to correct than the Docker-only story
  (`docker-compose.prod.yml`) since the real site is indeed host-served
  static files — but the script targets a generic `deploy@your-prod-host`
  placeholder, was not the tool actually used during this audit (plain SSH
  + `npm run build` on the host was), and its architecture framing (implying
  systemd-managed everything) predates the current mixed Docker/systemd/bare
  reality documented in Section 2.
- **`DEPLOYMENT_RUNBOOK.md`** — entirely `systemctl`-based (9 references,
  zero to Docker). Describes a pre-Docker-migration deployment model.
- **`OPERATIONAL_MANUAL.md`** — references `vitaloop.softdab.tech` as the
  production domain (it's `vitaloop.today`) and describes nginx serving
  directly with no mention of the backend's Docker container at all.

If you update deploy tooling or infra, update *this* file. If you're
tempted to write a new one-off `DEPLOYMENT_*.md` or `*_REPORT.md` instead —
don't; this repo already has 140+ scattered markdown files from that
pattern. Extend this one.
