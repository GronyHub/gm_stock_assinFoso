import sql from '@/lib/db'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can perform this operation' }, { status: 403 })
  }

  try {
    const results: any[] = []

    // Find all services using GMC that have loss revision records
    const services = await sql`
      SELECT DISTINCT i.id, i.canonical_name, i.converts_to_item_id
      FROM items i
      JOIN stock_count_revisions scr ON i.id = scr.item_id
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.status IS NULL
    `

    for (const service of services) {
      const target = await sql`SELECT id, canonical_name FROM items WHERE id = ${service.converts_to_item_id}`
      if (!target || target.length === 0) continue

      const targetId = target[0].id

      // Count loss records to transfer
      const [countResult] = await sql`
        SELECT COUNT(*)::int as cnt FROM stock_count_revisions WHERE item_id = ${service.id}
      `
      const recordsToTransfer = countResult?.cnt || 0

      if (recordsToTransfer > 0) {
        // Transfer the loss revision records to the target item
        await sql`
          UPDATE stock_count_revisions
          SET item_id = ${targetId}
          WHERE item_id = ${service.id}
        `

        results.push({
          service_id: service.id,
          service_name: service.canonical_name,
          target_id: targetId,
          target_name: target[0].canonical_name,
          loss_records_transferred: recordsToTransfer,
        })
      }
    }

    return NextResponse.json({
      success: true,
      transferred: results.length,
      results,
      message: `Successfully transferred loss records from ${results.length} service${results.length !== 1 ? 's' : ''}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
