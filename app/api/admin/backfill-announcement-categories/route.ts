import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import sql from '@/lib/db'

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
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return badRequest('Forbidden')
  }

  try {
    const results: string[] = []
    let fixedCount = 0

    try {
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT`
      results.push('category column: OK')
    } catch (e: any) { results.push(`category column FAILED: ${e.message}`) }

    try {
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

    return success({ results, distribution })
  } catch (e) {
    return handleError('admin/backfill-announcement-categories', e)
  }
}
