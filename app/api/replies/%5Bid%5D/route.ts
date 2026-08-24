import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function DELETE(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const pathId = req.nextUrl.pathname.split('/').pop()
  const id = parseInt(pathId || '0')
  if (!id) return badRequest('Reply ID required')

  try {
    await sql`DELETE FROM item_replies WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) {
    return handleError('replies/[id]', e)
  }
}
