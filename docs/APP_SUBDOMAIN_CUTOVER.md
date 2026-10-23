# English cabinet cutover: `app.vitaloop.today`

## Scope and invariants

- `https://vitaloop.today` remains the public English marketing and Health Hub site.
- `https://app.vitaloop.today` is the English end-user app: assessment, auth and cabinet.
- `https://api.vitaloop.today` remains the API.
- `https://crm.vitaloop.today` remains the CRM.
- `https://ua.vitaloop.today`, its nginx configuration, auth flow and WayForPay
  flow are explicitly out of scope.

This repository ships an **unenabled** app vhost at
`ops/nginx/app.vitaloop.today.conf` and an **opt-in** legacy redirect snippet
at `ops/nginx/vitaloop-cabinet-legacy-redirects.conf`. Do not enable either
until the previous stage has passed its checks.

## Release-order safety gate

This release changes public English CTAs to enter the cabinet at
`app.vitaloop.today`. The hostname currently serves a retired SoftDab site.
**Do not merge or deploy this release until sections 1–3 are complete**;
otherwise a public CTA could lead to that retired site.

The release uses these production frontend build values:

```text
VITE_API_BASE_URL=https://api.vitaloop.today
VITE_APP_BASE_URL=https://app.vitaloop.today
VITE_EMAIL_CONFIRMATION_PATH=https://app.vitaloop.today/auth/confirmation
```

## 1. Prepare the production origin

Before DNS changes, copy the staged vhost from this repository to the server:

```bash
scp ops/nginx/app.vitaloop.today.conf root@PROD_HOST:/etc/nginx/sites-available/app.vitaloop.today
```

Add these **non-secret** backend environment values to
`/var/www/VITALOOP/backend/.env`. They take effect when the release recreates
the backend container in section 4:

```text
ALLOWED_ORIGINS=https://vitaloop.today,https://www.vitaloop.today,https://app.vitaloop.today,https://crm.vitaloop.today,https://ua.vitaloop.today,https://www.ua.vitaloop.today
END_USER_APP_BASE_URL=https://app.vitaloop.today
```

Keep `FRONTEND_BASE_URL=https://vitaloop.today`. It remains the public-site
origin so generic/UA flows are not silently moved by this EN-only migration.

1. Back up the existing nginx state:

   ```bash
   sudo cp -a /etc/nginx/sites-available /etc/nginx/sites-available.pre-app-$(date +%F)
   sudo cp -a /etc/nginx/sites-enabled /etc/nginx/sites-enabled.pre-app-$(date +%F)
   ```

2. Ensure `/etc/nginx/sites-available/app.vitaloop.today` is the staged file
   from this repository. It proxies to the existing frontend container on
   `127.0.0.1:8080`; it does not create a second app container.

3. Provision a valid origin certificate containing `app.vitaloop.today`.
   Either issue a Certbot certificate for that hostname, matching the paths in
   the vhost, or install a Cloudflare Origin Certificate and adjust the two
   `ssl_certificate*` lines to its restricted-permission paths. Do not use a
   certificate for another hostname unless it has `app.vitaloop.today` as a
   SAN/wildcard.

4. Enable only the app vhost and validate before reload:

   ```bash
   sudo ln -s /etc/nginx/sites-available/app.vitaloop.today /etc/nginx/sites-enabled/app.vitaloop.today
   sudo nginx -t
   sudo systemctl reload nginx
   ```

Do **not** enable the legacy redirect snippet in this stage.

## 2. Cloudflare DNS and TLS

The current `app.vitaloop.today` hostname serves a retired SoftDab project.
Replace it only after the origin in step 2 is ready.

1. Replace the current `app` record with one proxied record that targets the
   same production origin as `vitaloop.today`:

   ```text
   Type: CNAME
   Name: app
   Target: vitaloop.today
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

   If the existing production DNS policy requires A records, use the exact
   same origin IPv4 address as the apex instead; do not create a second
   origin.

2. Set **SSL/TLS encryption mode: Full (strict)**. Never select Flexible.
3. Confirm that the Cloudflare edge certificate covers `app.vitaloop.today`
   and that the origin certificate installed in step 2 validates.
4. Do not add a cache rule that caches HTML, `sw.js`, `registerSW.js`,
   `manifest.json`, or `build-info.json`. The origin sends no-cache headers
   for these. Hashed assets may remain cached.

## 3. Supabase and payment provider settings

### Supabase Auth

In **Auth → URL Configuration**:

1. Keep the current Site URL during the transition, or set it to
   `https://app.vitaloop.today` after the app smoke test is green.
2. Add these Redirect URLs; do not remove the existing `vitaloop.today`, UA,
   or CRM entries during the migration window:

   ```text
   https://app.vitaloop.today/**
   https://app.vitaloop.today/auth/confirmation
   https://app.vitaloop.today/login
   ```

3. Keep `https://crm.vitaloop.today/auth/post-login` allowed because the
   existing Google/CRM handoff continues to use it.
4. Check email templates use Supabase's confirmation URL variable, not a
   hardcoded `vitaloop.today` link.

### Creem / Stripe

The repository makes English Creem checkout success return to
`https://app.vitaloop.today/subscription?upgraded=true`. WayForPay is not
changed.

For any Stripe-hosted Checkout, Customer Portal, or manually configured return
URLs, add (rather than replace) these allowed URLs:

```text
https://app.vitaloop.today/subscription
https://app.vitaloop.today/billing-history
```

Keep the current webhook endpoint `https://vitaloop.today/api/stripe/webhook`
unchanged. It is an ingress endpoint, not a cabinet URL, and moving it is a
separate, webhook-verified change.

## 4. Deploy the repository release, then smoke test app

Now deploy the repository release through the normal CI/CD pipeline. CI stages
the app vhost and legacy redirect snippet but deliberately does not enable the
new app vhost or include redirects. It also updates the active API nginx vhost
to allow the app origin through CORS. Verify the existing English landing, API,
CRM and UA sites still respond normally before continuing.

Run the following before turning on redirects:

Run the following before turning on redirects:

```bash
curl -fsSI https://app.vitaloop.today/
curl -fsSI https://app.vitaloop.today/login
curl -fsSI https://app.vitaloop.today/auth/confirmation
curl -fsSI https://app.vitaloop.today/dashboard
curl -fsS -X OPTIONS https://api.vitaloop.today/auth/me \
  -H 'Origin: https://app.vitaloop.today' \
  -H 'Access-Control-Request-Method: GET' \
  -D - -o /dev/null | grep -i 'access-control-allow-origin: https://app.vitaloop.today'
```

Then complete a read-only browser smoke:

1. Open `https://app.vitaloop.today/` and verify it redirects to dashboard.
2. Complete email signup/confirmation and password-reset flows.
3. Sign in, visit dashboard, upload entry, results list, protocol, account,
   subscription and billing history without creating payment or changing data.
4. Verify a Creem checkout return uses `app.vitaloop.today` in test mode.
5. Verify `https://ua.vitaloop.today` login, payment and dashboard behavior
   remain unchanged.

After the app smoke is green, point the scheduled smoke monitor at the
cabinet explicitly (the repository default intentionally remains the public
site until this cutover is accepted):

```bash
VITALOOP_SMOKE_APP_URL=https://app.vitaloop.today node scripts/vitaloop-smoke-monitor.mjs
```

Only after those pass, add this line inside the existing
`vitaloop.today` TLS `server {}` block, before its catch-all `location /`:

```nginx
include /etc/nginx/snippets/vitaloop-cabinet-legacy-redirects.conf;
```

Install the repository snippet at that path, validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

CI stages `/etc/nginx/snippets/vitaloop-cabinet-legacy-redirects.conf` with
the release, but it remains inert until the explicit `include` above is added.
It sends only old English cabinet/auth routes to `app.vitaloop.today` with a
301 and preserves query strings. It deliberately does not redirect the public
landing, Health Hub, API, CRM, Stripe webhook or UA routes.

## Session behavior

Supabase browser sessions use origin-scoped storage. Existing users who are
already signed in on `vitaloop.today` will need to sign in once on
`app.vitaloop.today`; no access token is placed in URLs or copied across
origins. This is intentional and avoids exposing credentials during the
migration.

## Rollback

If app smoke fails:

1. Remove the enabled app symlink and reload nginx:

   ```bash
   sudo rm /etc/nginx/sites-enabled/app.vitaloop.today
   sudo nginx -t && sudo systemctl reload nginx
   ```

2. If already enabled, remove the legacy redirects `include` and the snippet
   from the apex vhost, then validate/reload. Old cabinet routes immediately
   resume from `vitaloop.today`.
3. Restore the previous Cloudflare `app` record only if it is required; this
   does not affect the apex, API, CRM or UA domains.
4. Revert the application release to the prior production SHA through the
   normal CI/CD rollback process. Do not roll back database state: this
   migration has no schema change.
