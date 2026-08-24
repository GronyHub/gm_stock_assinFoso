import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const { norm_name, keep_item_id } = await req.json()
    if (!norm_name) return badRequest('norm_name required')

    if (!keep_item_id) {
      const deleted = await sql`
        DELETE FROM item_aliases
        WHERE LOWER(TRIM(alias_name)) = ${norm_name}
        RETURNING id
      `
      return success({ ok: true, deletedCount: deleted.length, salesLinesMoved: 0, billLinesMoved: 0 })
    }

    const [winner] = await sql`SELECT canonical_name FROM items WHERE id = ${keep_item_id}`
    if (!winner) return notFound()

    const losers = await sql`
      SELECT DISTINCT item_id FROM item_aliases
      WHERE LOWER(TRIM(alias_name)) = ${norm_name} AND item_id <> ${keep_item_id}
    `
    const loserIds = losers.map((l: any) => l.item_id)

    const salesMoved = loserIds.length
      ? await sql`
          UPDATE sales_receipt_lines
          SET item_id = ${keep_item_id}, resolved_name = ${winner.canonical_name}, unresolved = false
          WHERE LOWER(TRIM(raw_item_name)) = ${norm_name} AND item_id = ANY(${loserIds})
          RETURNING id
        `
      : []
    const billsMoved = loserIds.length
      ? await sql`
          UPDATE bill_lines
          SET item_id = ${keep_item_id}, resolved_name = ${winner.canonical_name}, unresolved = false
          WHERE LOWER(TRIM(raw_item_name)) = ${norm_name} AND item_id = ANY(${loserIds})
          RETURNING id
        `
      : []

    const deleted = await sql`
      DELETE FROM item_aliases
      WHERE LOWER(TRIM(alias_name)) = ${norm_name}
        AND item_id <> ${keep_item_id}
      RETURNING id
    `

    return success({
      ok: true,
      deletedCount: deleted.length,
      salesLinesMoved: salesMoved.length,
      billLinesMoved: billsMoved.length,
    })
  } catch (e) {
    return handleError('aliases/ambiguous/resolve', e)
  }
}
