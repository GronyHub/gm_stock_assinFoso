import { requireAuth, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  const matchId = await getIdParam(params)
  await sql`DELETE FROM good_service_matches WHERE id = ${matchId}`
  return success({ ok: true })
}
