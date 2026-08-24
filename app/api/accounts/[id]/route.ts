import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const { name } = await req.json()

  if (!name || typeof name !== 'string' || !name.trim()) {
    return badRequest('Account name is required')
  }

  const trimmedName = name.trim()

  try {
    const [oldAccount] = await sql`SELECT name FROM accounts WHERE id = ${Number(id)}`
    if (!oldAccount) {
      return notFound()
    }

    const oldName = oldAccount.name

    await sql`UPDATE expenses SET expense_account = ${trimmedName} WHERE expense_account = ${oldName}`

    const [updated] = await sql`
      UPDATE accounts SET name = ${trimmedName}, updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING id, name
    `
    return success(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('duplicate key')) {
      return badRequest('Account name already exists')
    }
    return handleError('accounts/[id]', e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error

  const { id } = await params

  try {
    const [account] = await sql`SELECT id FROM accounts WHERE id = ${Number(id)}`
    if (!account) {
      return notFound()
    }

    await sql`DELETE FROM accounts WHERE id = ${Number(id)}`
    return success({ ok: true })
  } catch (e) {
    return handleError('accounts/[id]', e)
  }
}
