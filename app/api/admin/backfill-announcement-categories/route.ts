import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// The `category` column (see lib/logger.ts) was added 2026-07-21 with no
// backfill, so every auto-logged announcement from before that only shows
// up in the feed itself, not in the Home page's type filter dropdown
// (which reads DISTINCT category -- see /api/announcements/categories).
// This is a one-time fix: every auto-logged row's body is always exactly
// `${action} — ${details}` (or bare `action` with no details), built in
// logActivity, so the action is recoverable from body text without
// touching anything a person actually typed. Matched by exact known action
// strings (not "everything before the first em dash") specifically so a
// manually-typed post that happens to contain " — " never gets
// mis-tagged with a fake category.
const KNOWN_ACTIONS = [
  'added bill', 'edited bill',
  'added sale receipt', 'deleted sale receipt',
  'relinked mismatched sales lines', 'unlinked mismatched sales lines',
  'built payslips', 'confirmed payroll payment',
  'added customer',
  'marked advert recorded', 'marked advert missing',
  'auto-penalized', 'assigned task',
  'added expense', 'deleted item', 'merged items',
  'added receipt', 'recorded violation',
  'marked all as different items', 'marked as different items',
  'linked unresolved sales lines to item', 'marked no-work day',
  'edited time entry', 'deleted time entry', 'entered time',
  'confirmed opening counts', 'submitted closing report',
  'clocked in', 'clocked out',
  'submitted Advert daily checklist',
  'counted stock', 'reported count loss',
  'edited stock count', 'deleted stock count',
  'removed trade-off note', 'recorded trade-off',
]

export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: string[] = []
  let fixedCount = 0

  try {
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT`
    results.push('category column: OK')
  } catch (e: any) { results.push(`category column FAILED: ${e.message}`) }

  try {
    // One UPDATE per known action rather than a single bulk query -- this
    // is a one-time admin migration, not a hot path, so simplicity and
    // being sure each match is exact matter more than round-trip count.
    for (const action of KNOWN_ACTIONS) {
      const rows = await sql`
        UPDATE announcements
        SET category = ${action}
        WHERE category IS NULL AND (body = ${action} OR body LIKE ${action + ' — %'})
        RETURNING id
      `
      fixedCount += rows.length
    }
    results.push(`known-action backfill: ${fixedCount} row(s)`)
  } catch (e: any) { results.push(`known-action backfill FAILED: ${e.message}`) }

  try {
    // Grony Manage's log categories (Arrangement/Cleanliness/etc.) produce a
    // dynamic action string ("logged <category with _ as spaces>") that
    // can't be listed exactly above -- extracted directly instead, safe
    // because the fixed "logged " prefix + all-lowercase-words shape isn't
    // something a real typed message would coincidentally match.
    const res = await sql`
      UPDATE announcements
      SET category = split_part(body, ' — ', 1)
      WHERE category IS NULL AND body ~ '^logged [a-z ]+ — '
      RETURNING id
    `
    results.push(`"logged X" backfill: ${res.length} row(s)`)
  } catch (e: any) { results.push(`"logged X" backfill FAILED: ${e.message}`) }

  const distribution = await sql`
    SELECT category, COUNT(*)::int AS n FROM announcements
    GROUP BY category ORDER BY n DESC
  `

  return NextResponse.json({ results, distribution })
}
