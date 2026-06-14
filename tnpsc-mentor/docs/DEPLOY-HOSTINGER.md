# Deploying TNPSC Mentor to Hostinger

The backend (Supabase Cloud) is already live, so deployment = uploading the
static frontend build. The build is in **`dist/`** and is also zipped as
**`tnpsc-mentor-dist.zip`** in the project root for easy upload.

> **Rebuild any time** with `npm run build`. The build bakes in the Supabase URL
> + anon key from `.env` at build time, and copies `public/.htaccess` into
> `dist/` automatically (handles SPA routing — see below).

---

## A. Hostinger shared hosting (hPanel) — most common

1. **hPanel → Files → File Manager** (or use FTP).
2. Go into your domain's web root — usually **`public_html`**. If deploying to a
   subdomain (e.g. `app.yourdomain.com`), use that subdomain's folder instead.
3. **Delete any default placeholder** (`default.php`, Hostinger's `index.html`).
4. **Upload `tnpsc-mentor-dist.zip`** into `public_html`, then **right-click →
   Extract**. Make sure the extracted files (`index.html`, `assets/`,
   `.htaccess`, `favicon.svg`) sit **directly in `public_html`**, not in a
   nested `dist/` subfolder. Move them up one level if needed, then delete the
   zip.
5. **Confirm `.htaccess` is present** (enable "show hidden files" in File
   Manager if you don't see it). This file makes deep links like `/quiz` and
   `/result` work on refresh — without it those URLs 404.
6. Visit your domain — the app should load at the login screen.

## B. Hostinger VPS (Nginx)

1. Upload `dist/` to the server (e.g. `scp -r dist/* user@vps:/var/www/tnpsc/`).
2. Nginx server block — the SPA fallback is the important line:

   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     root /var/www/tnpsc;
     index index.html;

     # SPA fallback: serve index.html for any unmatched route
     location / {
       try_files $uri $uri/ /index.html;
     }

     # Cache hashed assets aggressively
     location /assets/ {
       expires 1y;
       add_header Cache-Control "public, immutable";
     }
   }
   ```
   (On Nginx the `.htaccess` is ignored — the `try_files` line replaces it.)
3. `sudo nginx -t && sudo systemctl reload nginx`.
4. Add HTTPS with `sudo certbot --nginx -d yourdomain.com`.

---

## C. One required Supabase step (both options)

Auth emails (login redirect, password reset) must point at the live domain:

1. **Supabase dashboard → Authentication → URL Configuration**.
2. Set **Site URL** to your production URL (e.g. `https://yourdomain.com`).
3. Add it to **Redirect URLs** as well.

Without this, password-reset and confirmation links point at localhost.

---

## D. Smoke test after deploy

- [ ] App loads at the domain (login screen).
- [ ] **Refresh on a deep link** (e.g. `/test-arena`) — should NOT 404
      (confirms `.htaccess` / `try_files` works).
- [ ] Register a new account → confirm you land in the app.
- [ ] Start a test → answer a few → submit → Result page shows score.
- [ ] If ≥80% attempted: **Download Explanation PDF** works.
- [ ] Switch language (English / Tamil) renders correctly.

---

## E. Custom domain / DNS

If the domain isn't on Hostinger yet: hPanel → Domains → point the domain's
A record to Hostinger's server IP (shared) or the VPS IP. DNS can take up to a
few hours to propagate.
