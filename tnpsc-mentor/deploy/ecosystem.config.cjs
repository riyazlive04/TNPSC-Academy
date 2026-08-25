// PM2 process file for the TNPSC Mentor Express API.
// Run from the `server/` directory (after `npm run build`):
//   cd /var/www/tnpsc-app/server
//   pm2 start ../deploy/ecosystem.config.cjs
//   pm2 save           # persist across reboots
//   pm2 startup        # print the systemd command to enable boot-start
//
// Env (PORT, NODE_ENV, SUPABASE_*, etc.) is read from server/.env by the app's
// own dotenv import — keep secrets there, NOT in this file.
//
// instances: 4 matches the VPS's 4 vCPUs. Cluster mode also makes `pm2
// reload` zero-downtime. Caveat: express-rate-limit uses its default
// in-memory store (no `store:` configured), which is per-process — with 4
// instances the effective limit on any given rate-limited route is up to 4x
// the configured `max`. Add a shared store (e.g. Redis) if that matters.
module.exports = {
  apps: [
    {
      name: 'tnpsc-api',
      cwd: '/var/www/tnpsc-app/tnpsc-mentor/server',
      script: 'dist/index.js',
      instances: 4,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
