# Deploying TNPSC Mentor to a Hostinger VPS (KVM 4)

Two-host deploy on one VPS. **Nginx** serves the built SPA on both hostnames and
reverse-proxies `/api` (on the app subdomain) to the **Express API** (run by
**PM2**). The database stays on **Supabase Cloud** — nothing to migrate there.

```
                 ┌─ tnpscmentors.in       → /var/www/tnpsc  (landing page)
Browser ─HTTPS─▶ Nginx
                 └─ app.tnpscmentors.in   → /var/www/tnpsc  (web app, SPA "/")
                          └─ /api/         → 127.0.0.1:4000  (Express via PM2)
                                                  └──▶ Supabase Cloud
```

The SPA's `VITE_API_URL` is the **app subdomain**, so all API calls are
same-origin with the app (login cookies work). The landing page's sign-in
buttons hard-link to the app subdomain — that target is already set in
`src/pages/LandingPage.tsx` as `APP_URL = 'https://app.tnpscmentors.in'`.
**If your real domain differs, change `APP_URL` there before building.**

KVM 4 (4 vCPU / 16 GB) is far more than enough — building on-box is fine.

---

## 0. Before you start — DNS

Point both hostnames at the VPS **before** requesting SSL:

- `A` record `@`   (tnpscmentors.in)      → your VPS IPv4
- `A` record `www` (www.tnpscmentors.in)  → your VPS IPv4
- `A` record `app` (app.tnpscmentors.in)  → your VPS IPv4

Wait until all three resolve to the VPS IP (`ping app.tnpscmentors.in`). If the
domain is registered with Hostinger, manage these in hPanel → DNS.

---

## 1. Server prep (Ubuntu 22.04/24.04)

SSH in as root (Hostinger gives you the IP + password / lets you add an SSH key):

```bash
ssh root@YOUR_VPS_IP

# create a non-root sudo user (recommended)
adduser deploy && usermod -aG sudo deploy
# then log back in as: ssh deploy@YOUR_VPS_IP

sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl ufw rsync

# Node.js 20 LTS (the project requires >=20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # should print v20.x

# PM2 process manager
sudo npm install -g pm2
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # opens 80 + 443
sudo ufw enable
```

---

## 2. Get the code onto the VPS

```bash
sudo mkdir -p /var/www/tnpsc-app && sudo chown -R $USER:$USER /var/www/tnpsc-app
cd /var/www/tnpsc-app

# Option A — clone your repo (the git root is TNPSC-Academy)
git clone YOUR_REPO_URL .
# the app then lives at /var/www/tnpsc-app/tnpsc-mentor

# Option B — from your Windows machine, copy the folder up with scp/rsync
#   (exclude node_modules / dist — they get rebuilt on the VPS)
```

> The paths in `deploy/ecosystem.config.cjs` and `deploy/deploy.sh` assume the
> app at `/var/www/tnpsc-app/tnpsc-mentor`. Adjust if you put it elsewhere.

### 2a. Exclude the mobile projects (do this once, right after cloning)

The repo carries the `android/` and `ios/` Capacitor projects because they hold
hand-written store-compliance config that `cap sync` cannot regenerate. The VPS
serves the web app only and never builds either of them, so it has no reason to
check them out — about 4.6 MB of source that would just sit there.

Sparse checkout keeps them out of this working tree without changing the repo,
so a Mac clone still gets the full iOS project:

```bash
cd /var/www/tnpsc-app          # the GIT ROOT, one level above tnpsc-mentor

git config core.sparseCheckout true
cat > .git/info/sparse-checkout <<'EOF'
/*
!/tnpsc-mentor/android/
!/tnpsc-mentor/ios/
EOF

git read-tree -mu HEAD

# Verify — neither directory should be listed:
ls tnpsc-mentor/
```

This is persistent local config: every later `git pull` keeps excluding them,
and `deploy/deploy.sh` never touches those paths.

> **Note on `node_modules`.** The Capacitor plugin packages (~23 MB, mostly Swift
> and Java source inside the npm tarballs) DO still install here, and cannot be
> dropped. Vite has to *resolve* the dynamic `import('@capgo/native-purchases')`
> at build time to emit its chunk; without the package the web build fails. They
> are install-time only — nothing native is ever served to a browser beyond a
> ~10 KB lazy chunk that is never fetched. Removing them would mean maintaining
> a separate stubbed web build, and the risk of shipping that stub to a store is
> worse than the disk.

---

## 3. Environment files

```bash
cd /var/www/tnpsc-app/tnpsc-mentor

# Frontend build env (Vite inlines at build time)
cp deploy/frontend.env.production.example .env.production
nano .env.production          # VITE_API_URL=https://app.tnpscmentors.in

# Server runtime env
cp deploy/server.env.production.example server/.env
nano server/.env              # paste Supabase + Razorpay + VAPID values;
                              # CORS_ORIGIN already lists app + main + www
```

Copy the **real secret values** from your current Render/Vercel setup (your
existing `server/.env` already has them locally — reuse those same Supabase
keys; the DB is unchanged).

---

## 4. Build

```bash
cd /var/www/tnpsc-app/tnpsc-mentor

# Frontend → dist/
npm ci
npm run build

# Publish SPA to the web root
sudo mkdir -p /var/www/tnpsc
sudo rsync -a --delete dist/ /var/www/tnpsc/

# API → server/dist/
cd server
npm ci
npm run build
cd ..
```

---

## 5. Start the API under PM2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 logs tnpsc-api --lines 20      # confirm "API listening on ...:4000"
curl http://127.0.0.1:4000/api/health   # -> {"status":"ok"}

pm2 save                            # persist process list
pm2 startup                         # run the printed `sudo env ...` line to
                                    # auto-start PM2 on reboot
```

---

## 6. Nginx

```bash
# The config already uses tnpscmentors.in / app.tnpscmentors.in. If your real
# domain differs, replace it first:
#   sed -i 's/tnpscmentors.in/yourdomain.com/g' deploy/nginx-tnpsc.conf

sudo cp deploy/nginx-tnpsc.conf /etc/nginx/sites-available/tnpsc
sudo ln -sf /etc/nginx/sites-available/tnpsc /etc/nginx/sites-enabled/tnpsc
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

At this point `http://tnpscmentors.in` (landing) and `http://app.tnpscmentors.in`
(app) should both load over plain HTTP.

---

## 7. SSL (Let's Encrypt) — all three hostnames

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d tnpscmentors.in -d www.tnpscmentors.in -d app.tnpscmentors.in
# choose "redirect HTTP -> HTTPS" when prompted
```

Certbot rewrites the Nginx config to add the `:443` blocks + auto-renews via a
systemd timer. Verify renewal: `sudo certbot renew --dry-run`.

Now both hosts serve over HTTPS, and the refresh-token cookie (Secure +
SameSite=None, enabled by `NODE_ENV=production`) works on the app subdomain.

---

## 8. Update external services to the new domains

These point at your old Vercel/Render URLs — repoint them:

- **Google Cloud Console** → OAuth Client → *Authorized JavaScript origins*:
  add `https://app.tnpscmentors.in` (where sign-in actually runs). Add the main
  domain too if you ever sign in there.
- **Supabase → Auth → URL Configuration**: set Site URL to
  `https://app.tnpscmentors.in` and add it (+ the main domain) to Redirect URLs.
- **Razorpay**: switch keys `rzp_test_…` → `rzp_live_…` when going live, and
  update any webhook/callback URLs.
- **Web Push (VAPID)**: keys are domain-independent — reuse the existing pair.

---

## 9. Redeploys (after the first time)

```bash
cd /var/www/tnpsc-app/tnpsc-mentor
git pull
bash deploy/deploy.sh        # rebuilds SPA + API, republishes, reloads PM2
```

---

## Notes / gotchas

- **No APK** in this pass — the web deploy above is independent of Capacitor.
  When you build the APK later, point its `.env.production` `VITE_API_URL` at
  `https://app.tnpscmentors.in` so the app reaches this same API.
- **The APK download link 404s for now.** `LandingPage.tsx` has
  `APK_DOWNLOAD_URL = '/downloads/tnpsc-mentor.apk'`. Until you host an APK there
  the download button errors — expected, since we're skipping the APK.
- **`APP_URL` in `LandingPage.tsx` is hardcoded** to `https://app.tnpscmentors.in`.
  If your real domain differs, change it (and rebuild) or the landing page's
  sign-in buttons point at the wrong host.
- **`VITE_API_URL` must be set at build time.** If it's empty the production
  build silently runs in UI-preview mode (no auth). It's baked into the bundle,
  so changing it means rebuilding the frontend.
- **Cookies:** sign-in happens on the app subdomain where the API is same-origin,
  so the refresh cookie just works. Keep `NODE_ENV=production` so it's `Secure`.
  The main domain only fires one (cross-origin) `me()` call on load — allowed by
  CORS, returns 401, landing stays logged-out. That's why the main + www domains
  are in `CORS_ORIGIN`.
- **Migrations / data scripts** (`server/*.mjs`) still run against Supabase
  Cloud — set the `SUPABASE_DB_*` vars in `server/.env` only if you need them.
- **Logs**: `pm2 logs tnpsc-api`, Nginx at `/var/log/nginx/{access,error}.log`.
  The API writes one JSON line per request (method, path, status, ms, user id,
  IP) to PM2's stdout — that IS the access log. **Install the rotation rule** so
  it doesn't grow without bound and so the 90-day retention the Privacy Policy
  states is actually true:
  `sudo cp deploy/logrotate-tnpsc /etc/logrotate.d/tnpsc && sudo mv /etc/logrotate.d/nginx /etc/logrotate.d/nginx.disabled && sudo logrotate -d /etc/logrotate.d/tnpsc`
- **Breach detection**: set `SECURITY_ALERT_CHAT_ID` in `server/.env` or nothing
  pages you when the detectors fire (the API logs a warning at boot if it's
  missing). Apply `supabase/audit_log.sql` once — without it every audit write
  fails and the admin action trail is empty. Runbook: `docs/BREACH_RESPONSE.md`.
- **Memory**: optionally add swap on the VPS if builds ever feel tight (KVM 4's
  16 GB makes this unlikely): `sudo fallocate -l 2G /swapfile && sudo chmod 600
  /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`.
```
