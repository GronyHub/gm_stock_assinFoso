import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { ensureDismissedAliasReviews } from '@/lib/dismissedAliasReviews'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT raw_name, item_id, canonical_name, source, SUM(cnt)::int AS cnt FROM (
        SELECT srl.raw_item_name AS raw_name, srl.item_id, i.canonical_name, 'sales' AS source, COUNT(*)::int AS cnt
        FROM sales_receipt_lines srl
        JOIN items i ON i.id = srl.item_id
        WHERE srl.raw_item_name IS NOT NULL AND TRIM(srl.raw_item_name) <> ''
        GROUP BY srl.raw_item_name, srl.item_id, i.canonical_name
        UNION ALL
        SELECT bl.raw_item_name, bl.item_id, i.canonical_name, 'bills', COUNT(*)::int
        FROM bill_lines bl
        JOIN items i ON i.id = bl.item_id
        WHERE bl.raw_item_name IS NOT NULL AND TRIM(bl.raw_item_name) <> ''
        GROUP BY bl.raw_item_name, bl.item_id, i.canonical_name
      ) combined
      GROUP BY raw_name, item_id, canonical_name, source
      ORDER BY cnt DESC
    `

    const flagged = (rows as { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number }[])
      .map(r => ({ ...r, warning: aliasMismatchWarning(r.raw_name, r.canonical_name) }))
      .filter((r): r is typeof r & { warning: string } => r.warning !== null)

    await ensureDismissedAliasReviews()
    const dismissedRows = await sql`SELECT review_key FROM dismissed_alias_reviews WHERE review_type = 'flagged'`
    const dismissedKeys = new Set((dismissedRows as { review_key: string }[]).map(r => r.review_key))
    const visible = flagged.filter(r => !dismissedKeys.has(`${r.source}::${r.raw_name}::${r.item_id}`))

    return success(visible)
  } catch (e) {
    return handleError('aliases/audit', e)
  }
}
