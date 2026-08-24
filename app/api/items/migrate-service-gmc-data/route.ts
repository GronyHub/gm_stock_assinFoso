import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'

interface MigrationResult {
  service_id: number
  service_name: string
  target_id: number
  target_name: string
  counts_transferred: number
  bills_transferred: number
  cost_price_transferred: number | null
  sales_transferred: number
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) {
    return badRequest('Only Grony or Joe can perform migrations')
  }

  try {
    const results: MigrationResult[] = []

    // Find all services with target items and all counts in one query
    const serviceData = await sql`
      SELECT
        i.id,
        i.canonical_name,
        i.purchase_rate,
        i.converts_to_item_id,
        target.canonical_name as target_name,
        COALESCE((SELECT COUNT(*) FROM stock_counts WHERE item_id = i.id), 0)::int as counts_count,
        COALESCE((SELECT COUNT(*) FROM bill_lines WHERE item_id = i.id), 0)::int as bills_count,
        COALESCE((SELECT COUNT(*) FROM sales_receipt_lines WHERE item_id = i.id), 0)::int as sales_count
      FROM items i
      LEFT JOIN items target ON i.converts_to_item_id = target.id
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.converts_to_item_id IS NOT NULL
        AND i.status IS NULL
        AND target.id IS NOT NULL
    `

    // Perform all updates in parallel
    const toProcess = serviceData.filter(s => s.counts_count > 0 || s.bills_count > 0 || s.sales_count > 0)
    await Promise.all(
      toProcess.flatMap(s => {
        const updates: Promise<any>[] = []
        if (s.counts_count > 0) {
          updates.push(sql`
            UPDATE stock_counts
            SET item_id = ${s.converts_to_item_id}, item_name = ${s.target_name}
            WHERE item_id = ${s.id}
          `)
        }
        if (s.bills_count > 0) {
          updates.push(sql`
            UPDATE bill_lines
            SET item_id = ${s.converts_to_item_id}, resolved_name = ${s.target_name}
            WHERE item_id = ${s.id}
          `)
        }
        if (s.sales_count > 0) {
          updates.push(sql`
            UPDATE sales_receipt_lines
            SET item_id = ${s.converts_to_item_id}, resolved_name = ${s.target_name}
            WHERE item_id = ${s.id}
          `)
        }
        updates.push(sql`UPDATE items SET purchase_rate = NULL WHERE id = ${s.id}`)
        return updates
      })
    )

    // Build results
    for (const s of toProcess) {
      results.push({
        service_id: s.id,
        service_name: s.canonical_name,
        target_id: s.converts_to_item_id,
        target_name: s.target_name,
        counts_transferred: s.counts_count,
        bills_transferred: s.bills_count,
        cost_price_transferred: s.purchase_rate,
        sales_transferred: s.sales_count,
      })
    }

    return success({
      migrated: results.length,
      results,
      message: `Successfully migrated ${results.length} service${results.length !== 1 ? 's' : ''} using GMC`,
    })
  } catch (e) {
    return handleError('items/migrate-service-gmc-data', e)
  }
}
