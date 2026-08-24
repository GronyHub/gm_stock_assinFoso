import { requireAuth, badRequest, notFound, success } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  const lawId = await getIdParam(params)
  const { text } = await req.json()
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return badRequest('text is required')

  const [row] = await sql`UPDATE page_laws SET text = ${trimmed} WHERE id = ${lawId} RETURNING id, text, created_at`
  if (!row) return notFound()
  return success(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  const lawId = await getIdParam(params)
  await sql`DELETE FROM page_laws WHERE id = ${lawId}`
  return success({ ok: true })
}
