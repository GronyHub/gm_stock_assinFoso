import { requireAuth, getActorName, notFound, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const id = await getIdParam(params)
  const [row] = await sql`SELECT id, bill_id, description, amount FROM bill_expenses WHERE id = ${id}`
  if (!row) return notFound()

  await sql`DELETE FROM bill_expenses WHERE id = ${id}`

  const actor = getActorName(session)
  await logActivity(actor, 'deleted bill expense', `Bill #${row.bill_id} · ₵${Number(row.amount).toFixed(2)}${row.description ? ` — ${row.description}` : ''}`)

  return success({ ok: true })
}
