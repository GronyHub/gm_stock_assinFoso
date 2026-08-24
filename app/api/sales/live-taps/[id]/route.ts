import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  const { id: idStr } = await params
  const action = req.nextUrl.searchParams.get('action') || 'undo'
  const id = parseInt(idStr)

  if (!id) return badRequest('Invalid tap ID')

  try {
    await ensureLiveSaleTapsTable()

    if (action === 'undo') {
      await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${id}`
      return success({ success: true })
    }

    if (action === 'update-time') {
      const body = await req.json()
      const { tappedAt } = body
      if (!tappedAt) return badRequest('Missing tappedAt')

      await sql`UPDATE live_sale_taps SET tapped_at = ${tappedAt} WHERE id = ${id}`
      const [tap] = await sql`SELECT tapped_at FROM live_sale_taps WHERE id = ${id}`
      return success({ tapped_at: tap?.tapped_at })
    }

    return badRequest('Unknown action')
  } catch (e) {
    return handleError('sales/live-taps/[id]', e)
  }
}
