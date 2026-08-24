import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Only Grony or Joe can perform this operation')

  try {
    // Find all services with GMC loss revision records, joined with target items and counts
    const serviceData = await sql`
      SELECT
        i.id,
        i.canonical_name,
        i.converts_to_item_id,
        target.id as target_id,
        target.canonical_name as target_name,
        COUNT(scr.id)::int as record_count
      FROM items i
      JOIN stock_count_revisions scr ON i.id = scr.item_id
      LEFT JOIN items target ON i.converts_to_item_id = target.id
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.status IS NULL
      GROUP BY i.id, i.canonical_name, i.converts_to_item_id, target.id, target.canonical_name
    `

    const results: any[] = []
    const toTransfer = serviceData.filter(s => s.target_id && s.record_count > 0)

    // Transfer records in parallel for all services
    await Promise.all(toTransfer.map(s =>
      sql`
        UPDATE stock_count_revisions
        SET item_id = ${s.target_id}
        WHERE item_id = ${s.id}
      `.then(() => {
        results.push({
          service_id: s.id,
          service_name: s.canonical_name,
          target_id: s.target_id,
          target_name: s.target_name,
          loss_records_transferred: s.record_count,
        })
      })
    ))

    return success({
      success: true,
      transferred: results.length,
      results,
      message: `Successfully transferred loss records from ${results.length} service${results.length !== 1 ? 's' : ''}`,
    })
  } catch (e) {
    return handleError('fix-service-gmc-loss-records POST', e)
  }
}
