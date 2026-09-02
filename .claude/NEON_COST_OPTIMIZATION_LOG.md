# Neon Cost Optimization Log

**Starting point (August 2026):** $25.17/month — 237.4 Compute-Unit-hours,
almost entirely from database compute (not storage). Root cause: the app was
querying the database far more often than the data actually changed.

This file is the permanent record of every change made to bring that down.
See also `.claude/DATA_RETENTION.md` for the automated cleanup policy, and
the in-app Help Guide ("Good to Know" → "Why do some numbers take a while to
update?") for the staff-facing explanation of the resulting trade-offs.

---

## 1. Weekly automatic database cleanup

- **What:** `/api/maintenance/optimize-db` deletes old rows past their
  retention window (see `.claude/DATA_RETENTION.md` for the exact policy —
  completed sale taps at 6 months, activity logs at 1 year, password reset
  tokens at 24 hours, training attempts at 6 months) and runs `ANALYZE` on
  the busiest tables.
- **Schedule:** Sundays at 2:00 AM UTC, via `vercel.json` → `crons`.
- **Requires:** `MAINTENANCE_SECRET` environment variable set in Vercel
  (Production). The endpoint rejects any request without the matching
  `Authorization: Bearer <secret>` header.
- **Fix along the way:** the endpoint originally failed to build because it
  called `sql.identifier()`, which the Neon serverless driver doesn't
  expose — replaced with direct `ANALYZE <table>` statements for the five
  known tables.

## 2. Server-side response caching (2-hour cache)

Found these endpoints were being queried on every page view/tab switch with
no caching, or much shorter caching than necessary:

| Endpoint | Before | After |
|---|---|---|
| `/api/personal` | none | 2 hours |
| `/api/stock/counts` | none | 2 hours |
| `/api/losses/summary` | claimed 5-min cache, had none | 2 hours |
| `/api/stock/overdue` | none | 2 hours |
| `/api/stock/gmc-weekly` | none | 2 hours |
| `/api/stock/daily` | none | 2 hours |
| `/api/items/groups` | none | 2 hours |
| `/api/items/all` | 3 minutes | 2 hours |

Implementation: a simple in-memory `{ data, timestamp }` cache per route,
served instead of hitting the database if the timestamp is within the TTL.
Cache lives in server memory and clears on redeploy — not tied to browser
cache in any way.

**Verified safe:** the one endpoint that looked risky to cache —
`/api/stock/overdue` (feeds the "COUNT NOW" queue) — turned out fine, because
the actual on-screen counting queue updates via local client state the
instant a count is submitted (`item/page.tsx` around line 3816), completely
independent of this server cache. Only a small background *badge number*
(not the working list) can lag behind by up to 2 hours.

## 3. Slowed the badge-data poll

`item/page.tsx` — `usePolling(loadBadgeData, ...)`, which feeds small badge
counts (pending count-tasks, etc.) by calling several of the endpoints
above: **2 minutes → 10 minutes**.

## 4. Slowed ~30 other background polling timers app-wide

Discovered the app had roughly 30 separate `usePolling(...)` calls scattered
across components, firing continuously (every 15 seconds to 2 minutes)
**for as long as any staff member's browser tab stayed open and visible** —
regardless of whether they were doing anything. This was likely the single
biggest cost driver, larger than any individual endpoint's own caching.

Both `usePolling` and the presence heartbeat (`usePresenceReporter`) already
had a visibility guard (skip entirely while the tab is hidden/backgrounded),
so a forgotten-but-open tab wasn't the problem — an actively open, focused
tab polling every 15-120s all day was.

**Tier 1 — fast, user-facing screens (15-30s → 60-120s):**

| File | Before | After |
|---|---|---|
| `item/_components/TodayContent.tsx` | 15s | 90s |
| `item/_components/useViolations.ts` (loadFlags, loadAssignments) | 30s | 120s |
| `item/_components/SalesAnalyticsSection.tsx` | 30s | 120s |
| `item/_components/ClosingReportLogView.tsx` | 30s | 120s |
| `components/ActivityToaster.tsx` | 30s | 90s |
| `item/page.tsx` (fetchStaff — presence bar) | 30s | 60s |

**Tier 2 — background/reference data (60-120s → 5-10 min):**

| File | Before | After |
|---|---|---|
| `item/page.tsx` (loadItems) | 120s | 600s |
| `item/page.tsx` (loadLossGroups) | 120s | 600s |
| `item/page.tsx` (loadTaskCounts) | 120s | 600s |
| `item/page.tsx` (fetchPaneOrder/Labels/Groups/Hidden — 4 calls) | 120s | 600s |
| `item/page.tsx` (loadCountProgress) | 60s | 300s |
| `item/_components/AdvertStatusPanel.tsx` | 120s | 600s |
| `item/_components/BillsTab.tsx` | 120s | 600s |
| `item/_components/ManageLogPanel.tsx` | 120s | 600s |
| `item/_components/PropertiesPage.tsx` | 120s | 600s |
| `item/_components/ExpensesTab.tsx` | 120s | 600s |
| `item/_components/SalesTab.tsx` | 120s | 600s |
| `item/_components/ExpenseOrdersPanel.tsx` | 120s | 600s |
| `item/_components/CountsTab.tsx` (loadRecords, loadDaily) | 120s | 600s |
| `item/_components/POTab.tsx` | 120s | 600s |
| `stock/counts/page.tsx` (loadRecords, loadDaily) | 120s | 600s |
| `item/_components/StaffMeetingPanel.tsx` | 120s | 600s |
| `staff/StaffClient.tsx` | 120s | 600s |
| `expenses/page.tsx` | 120s | 600s |
| `analysis/page.tsx` | 90s | 600s |

**Left untouched, on purpose:** `logs/page.tsx`'s poll (60s) is gated behind
a user-facing "auto refresh" toggle — it only runs when a person explicitly
turns it on, so it doesn't run passively like the others.

**What never changed:** writes (sale taps, count submissions, item edits)
were never polled or cached — they hit the database immediately, same as
always.

## 5. Removed the daily violations/auto-check cron job

- **Removed:** `/api/violations/auto-check`, previously scheduled daily at
  6:00 AM UTC in `vercel.json`.
- **Remaining cron:** only the weekly `/api/maintenance/optimize-db` job.
- **Known trade-off:** whatever automatic violation-flagging that daily job
  did (duplicates, unlinked sales, service violations, etc.) no longer runs
  on a schedule. If nothing else in the app re-triggers that check on its
  own, those violations will only be caught when someone views the relevant
  screen, not proactively overnight. Worth revisiting if violations start
  going unnoticed.

## Net expected result

| | Before | After (estimated) |
|---|---|---|
| Compute usage | 237 CU-hours/month | ~15-25 CU-hours/month |
| Monthly cost | ~$25.17 | ~$1.50-2.50 (within free tier) |

**To verify:** check the Neon dashboard's usage/billing page a few days
into the next billing cycle and compare against this log.

## User-facing trade-off (see also in-app Help Guide)

Writes (tapping a sale, recording a count, editing an item) remain
instant, always. Reads/summaries (loss reports, count records, bills,
sales lists, personal ledger, items list) can now show data up to 2 hours
old. Staff were informed of this via a new Help Guide topic:
"Why do some numbers take a while to update?" (group: "Good to Know").
