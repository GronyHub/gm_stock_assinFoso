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

    // Find all services that use GMC (service_using_gmc)
    const services = await sql`
      SELECT i.id, i.canonical_name, i.purchase_rate, i.converts_to_item_id
      FROM items i
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.converts_to_item_id IS NOT NULL
        AND i.status IS NULL
    `

    for (const service of services) {
      const targetId = service.converts_to_item_id
      const [target] = await sql`SELECT id, canonical_name FROM items WHERE id = ${targetId}`
      
      if (!target) continue

      // Count stock_counts records to transfer
      const [[countResult]] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${service.id}`,
      ])
      const countsToTransfer = countResult?.n || 0

      // Count bill_lines records to transfer
      const [[billResult]] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${service.id}`,
      ])
      const billsToTransfer = billResult?.n || 0

      // Count sales_receipt_lines records to transfer
      const [[saleResult]] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${service.id}`,
      ])
      const salesToTransfer = saleResult?.n || 0

      // Transfer stock counts
      if (countsToTransfer > 0) {
        await sql`
          UPDATE stock_counts
          SET item_id = ${targetId}, item_name = ${target.canonical_name}
          WHERE item_id = ${service.id}
        `
      }

      // Transfer bill lines
      if (billsToTransfer > 0) {
        await sql`
          UPDATE bill_lines
          SET item_id = ${targetId}, resolved_name = ${target.canonical_name}
          WHERE item_id = ${service.id}
        `
      }

      // Transfer sales receipt lines
      if (salesToTransfer > 0) {
        await sql`
          UPDATE sales_receipt_lines
          SET item_id = ${targetId}, resolved_name = ${target.canonical_name}
          WHERE item_id = ${service.id}
        `
      }

      // Clear cost price from service (but capture it first)
      const costPrice = service.purchase_rate
      await sql`
        UPDATE items
        SET purchase_rate = NULL
        WHERE id = ${service.id}
      `

      results.push({
        service_id: service.id,
        service_name: service.canonical_name,
        target_id: targetId,
        target_name: target.canonical_name,
        counts_transferred: countsToTransfer,
        bills_transferred: billsToTransfer,
        cost_price_transferred: costPrice,
        sales_transferred: salesToTransfer,
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
