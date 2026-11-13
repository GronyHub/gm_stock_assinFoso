import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDismissedAliasReviews } from '@/lib/dismissedAliasReviews'

// Name conflicts: an alias that spells exactly the name of a DIFFERENT live item, so a sale typed with that name could land on the wrong item. Each row is one alias with both items
// side by side (the Name Conflicts review screen offers: remap the alias, delete it, or keep as-is, which is remembered in dismissed_alias_reviews).
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureDismissedAliasReviews()
    const rows = await sql`
      SELECT a.id AS alias_id, a.alias_name, a.alias_type, a.source AS alias_source,
             a.item_id AS aliased_to_item_id, t.canonical_name AS aliased_to_item_name, t.selling_rate::text AS aliased_to_sp, t.purchase_rate::text AS aliased_to_cp,
             c.id AS conflicting_item_id, c.canonical_name AS conflicting_item_name, c.status AS conflicting_item_status,
             c.selling_rate::text AS conflicting_sp, c.purchase_rate::text AS conflicting_cp
      FROM item_aliases a
      JOIN items t ON t.id = a.item_id
      JOIN items c ON LOWER(TRIM(c.canonical_name)) = LOWER(TRIM(a.alias_name)) AND c.id <> a.item_id
      WHERE (c.status IS NULL OR LOWER(c.status) <> 'inactive')
        AND NOT EXISTS (SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text)
      ORDER BY a.alias_name, a.id
    `
    return success(rows)
  } catch (e) {
    return handleError('aliases/leaks', e)
  }
}
