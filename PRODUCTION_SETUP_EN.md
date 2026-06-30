# VITALOOP.TODAY - English Version (Production Setup)

## Domain & Access
- **Primary Domain**: `vitaloop.today`
- **Alternative**: `www.vitaloop.today` → redirects to `vitaloop.today`
- **Server IP**: `159.65.252.227`
- **User**: `root`
- **Frontend**: `/var/www/VITALOOP/frontend/dist/`
- **Backend**: Runs on port `8006` (analysis service)

## Frontend Deployment Rules (CRITICAL)

### Core Principle
**Production build ALWAYS happens locally on Mac, NEVER on the server.**

1. **Local Build** (on Mac):
   ```bash
   cd frontend
   npm ci
   npm run build
   ```

2. **Deploy to Server** (via rsync):
   ```bash
   chmod +x ../scripts/deploy-frontend-dist.sh
   ../scripts/deploy-frontend-dist.sh
   ```

3. **Post-Deploy**:
   - SSH to server: `ssh root@159.65.252.227`
   - Reload nginx: `nginx -t && systemctl reload nginx`
   - Verify: https://vitaloop.today (hard refresh with Cmd+Shift+R)

### Important Notes
- **DO NOT run `npm run build` on server** — it's disabled
- **DO NOT use `git pull` for frontend on server** — only copy dist/
- **DO NOT touch git/npm/node on server** — they're not involved
- All fixes must go through: code → local build → rsync deploy

## Nginx Configuration
- **Config Path**: `/etc/nginx/sites-available/vitaloop.today`
- **Root Path**: `/var/www/VITALOOP/frontend/dist`
- **Index**: `index.html` (SPA fallback)
- **SSL**: Managed by Certbot (Let's Encrypt)

### Key Routes
- `/` → English landing page
- `/dashboard` → redirects to CRM (`crm.vitaloop.today/auth/post-login`)
- `/admin` → redirects to CRM admin
- `/ops` → redirects to CRM ops
- `/api/v1/*` → proxies to backend (port 8006)

### SPA Fallback
All unknown paths serve `index.html` for client-side routing:
```
location / {
    try_files $uri $uri/ /index.html;
}
```

## Frontend Structure (dist)
```
dist/
├── index.html              (main SPA entry, no-cache)
├── build-info.json        (build metadata, no-cache)
├── manifest.json          (PWA manifest, no-cache)
├── sw.js                  (service worker, no-cache)
├── registerSW.js          (SW registration, no-cache)
├── 404.html               (not found page)
├── robots.txt             (SEO)
├── sitemap.xml            (SEO)
├── assets/                (hashed files, 1-year cache)
│   ├── js/                (*.js, immutable)
│   ├── css/               (*.css, immutable)
│   └── images/            (*.png, *.svg, etc., immutable)
├── about/                 (SPA routes)
├── features/
├── how-it-works/
├── lab-results/
├── dashboard/
├── login/
├── onboarding/
├── settings/
└── ... (other SPA routes)
```

## Cache Strategy
- **HTML/Manifest/SW**: `no-cache, must-revalidate` — always revalidate
- **Hashed assets** (*.js, *.css, *.png, etc.): 1-year cache (`immutable`)
- Browser learns about updates via service worker

## Backend Integration
- **API Endpoint**: `https://vitaloop.today/api/v1/`
- **Backend Service**: `http://127.0.0.1:8006` (internal)
- **Timeout**: 180s read/write (for long-running analysis)
- **Headers**: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`

## Security Headers (Applied by nginx)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Common Deployment Scenarios

### Fix a Bug
1. Fix code in `frontend/src/`
2. Test locally: `npm run dev`
3. Build: `npm run build`
4. Deploy: `scripts/deploy-frontend-dist.sh`
5. Verify: https://vitaloop.today (Cmd+Shift+R)

### Update Content/Copy
1. Edit content in `frontend/src/`
2. Same steps as above

### Emergency Rollback
```bash
# If old build is still available locally
npm run build
scripts/deploy-frontend-dist.sh
```

## Monitoring & Diagnostics

### Check Deployment Status
```bash
ssh root@159.65.252.227 "ls -la /var/www/VITALOOP/frontend/dist/ | head -20"
```

### Verify nginx
```bash
ssh root@159.65.252.227 "nginx -t"
```

### Check Recent Files
```bash
ssh root@159.65.252.227 "ls -lt /var/www/VITALOOP/frontend/dist/ | head -10"
```

### View nginx Logs
```bash
ssh root@159.65.252.227 "tail -f /var/log/nginx/access.log | grep vitaloop.today"
```

## Related Documentation
- [PRODUCTION_SETUP_UA.md](../vitaloop_ua/PRODUCTION_SETUP_UA.md) — Ukrainian version setup
- [nginx.vitaloop.conf](./nginx.vitaloop.conf) — Full nginx configuration
- [scripts/deploy-frontend-dist.sh](./scripts/deploy-frontend-dist.sh) — Deployment script

## Last Updated
2026-06-30
