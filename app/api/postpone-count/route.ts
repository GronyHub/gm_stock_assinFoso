import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const { itemId, days = 3 } = await req.json()
    if (!itemId) return badRequest('Missing itemId')

    const [item] = await sql`SELECT id, canonical_name, count_cadence_days FROM items WHERE id = ${Number(itemId)}`
    if (!item) return badRequest('Item not found')

    const currentCadence = item.count_cadence_days || 0
    const newCadence = currentCadence + days

    // Calculate postponed_until date: today + days
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const postponedUntilDate = new Date(today)
    postponedUntilDate.setDate(postponedUntilDate.getDate() + days)
    const postponedUntilStr = postponedUntilDate.toISOString().split('T')[0]

    await sql`UPDATE items SET count_cadence_days = ${newCadence}, count_postponed_until = ${postponedUntilStr} WHERE id = ${Number(itemId)}`

    const actor = (session?.user as any)?.username || session?.user?.name || 'Unknown'
    await logActivity(actor, 'postponed count', `${item.canonical_name} by ${days} days until ${postponedUntilStr} (${currentCadence} → ${newCadence} days)`)

    return success({
      ok: true,
      itemId: item.id,
      itemName: item.canonical_name,
      previousCadence: currentCadence,
      newCadence,
      postponedUntil: postponedUntilStr,
      message: `Count postponed by ${days} days`,
    })
  } catch (e) {
    return handleError('postpone-count POST', e)
  }
}
