# Move the database from US East to London

Prepared 2026-10-13. **Nothing has been changed yet.** Do this on a Sunday (shop closed).

## Why
- App server (DigitalOcean droplet): **London**. Database (Neon project `flat-cake-07459152`, "Grony Finance"): **AWS us-east-1, N. Virginia**.
- Every query crosses the Atlantic (~80-100 ms each way). Most screens run 5-10 queries one after another, so 0.5-1 s of every screen is just travel.
- Same-region round trips are ~1-2 ms. Expected result: every screen noticeably faster, with no code changes.

## What is being moved (measured 2026-10-13)
| Item | Value |
|---|---|
| Size | 23 MB (Neon reports 48 MB incl. history) |
| Tables / views / functions / triggers | 87 / 6 / 38 / 4 |
| Extensions | `pg_trgm`, `pg_stat_statements`, `plpgsql` (all available on Neon London) |
| Schemas | `public` only |
| How the app connects | `lib/db.ts`: one `DATABASE_URL`, Neon serverless driver. **Switching = changing that one setting and restarting.** |

Neon cannot move a project between regions, so the plan is a **new project in `aws-eu-west-2` (London)** plus a copy of the data. The old project stays untouched as the fallback.

## Status log
- 2026-10-13: empty London project created: **`still-queen-41279218`** ("Grony Finance London", aws-eu-west-2, Postgres 18.6, compute 0.25-1 CU to match the old project). No data copied; the live app still uses the old database.

## Before the day
1. **Create the new project** in London (name e.g. "Grony Finance London"). Empty; no effect on the live app. Copy its **direct** connection string (not the "pooled" one) and keep it private.
2. **Prove the gain first** (read-only), on the droplet:
   `OLD_DATABASE_URL=... NEW_DATABASE_URL=... node scripts/db-latency-test.mjs`
   Expect old about 80-100 ms and new about 1-5 ms per `SELECT 1`.
3. Find where the app reads `DATABASE_URL` on the droplet: `grep -l DATABASE_URL /root/app/.env* /etc/cron.d/* 2>/dev/null`. Note the file (usually `/root/app/.env.local`).
4. Install the Postgres 18 client tools on the droplet (matches the server version):
   `apt-get install -y postgresql-common && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y && apt-get install -y postgresql-client-18`
5. **Rehearse the copy once** into the new project (steps 3-4 below) while the shop is open. It only reads the old database. Then compare counts. This proves the procedure before the real run.
6. Tell staff (WhatsApp group) the app will be down for about 15 minutes on Sunday.

## Sunday cutover (about 15 minutes)
1. **Stop the app** so nothing writes: `pm2 stop grony-app`.
2. **Dump the old database** (direct URL):
   `pg_dump "$OLD_URL" --format=custom --no-owner --no-acl -f /root/grony-final.dump`
3. **Restore into London**:
   `pg_restore --no-owner --no-acl --clean --if-exists --dbname="$NEW_URL" /root/grony-final.dump`
   Harmless warnings about `pg_stat_statements` or missing roles can be ignored; errors about tables/data cannot.
4. **Verify nothing was lost**:
   `OLD_DATABASE_URL=... NEW_DATABASE_URL=... node scripts/compare-db-counts.mjs`
   Must print `0 problem(s)`. If not, stop here, restart the app on the old database (see Rollback) and investigate.
5. **Switch**: edit the `DATABASE_URL` line in the file found earlier to the London URL (`chmod 600` stays), then `pm2 restart grony-app --update-env`.
6. **Smoke test** (as a logged-in manager): open Items / Live Sale, Sales Rec, Bills, Cust. Receipts, Customers; tap one test sale and undo it; check `pm2 logs grony-app --lines 50` shows no database errors.
7. Re-run `node scripts/db-latency-test.mjs` against the app's URL for the record.

## Rollback (if anything looks wrong)
Put the old `DATABASE_URL` back and `pm2 restart grony-app --update-env`. This is safe **only before staff enter new data on the new database**. After that, new rows exist only in London; they would have to be copied back. So do the smoke test before announcing the app is open.

## After
- Keep the old Neon project for **7 days**, then delete it (after one more weekly check and a final dump saved off the droplet).
- Tell Claude the new project id so the database tools point at London.
- Neon settings on the new project: leave compute small (0.25-1 CU) and default auto-suspend; the cache warm-up already limits wake-ups to shop hours.
- Update the cost notes in `AGENTS.md` (region changed; storage is ~23 MB, the 10 GB limit is not a concern).
- Optional later: keep a nightly `pg_dump` on the droplet as a second backup.

## Risks and how they are covered
| Risk | Cover |
|---|---|
| Data missed during copy | App stopped before the final dump; row counts compared table by table |
| Wrong connection string (pooled vs direct) | Use the **direct** string for dump/restore; the app works with either |
| Restore error on an extension | Same extensions exist in London; rehearsal finds this beforehand |
| Something odd after switching | Old database untouched; rollback is one setting plus a restart |
| Secrets leaking | Connection strings are never pasted into chat, commits or logs |

## Decisions needed
1. **Date** for the cutover (a Sunday).
2. **OK to create the empty London project now** (no effect on the live app).
3. Who runs the droplet commands (or Claude walks through each one live).
