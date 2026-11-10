# Grony Multimedia app

Shop management for Grony Multimedia: Live Sale, stock counts, sales log, customers, Company Laws, the Daily Checklist, staff times, penalty points and CCTV reviews.

- **Stack:** Next.js (App Router), NextAuth, Neon Postgres.
- **Hosting:** a DigitalOcean droplet (New York) behind Caddy, run with pm2. Pushing to `main` deploys automatically (`.github/workflows/deploy.yml`).
- **Before changing code:** read `AGENTS.md` (project rules) and `CLAUDE.md`.
- **Local run:** `npm install`, set `DATABASE_URL` and `AUTH_SECRET`, then `npm run dev`.
