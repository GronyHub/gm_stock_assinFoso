import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name } = await req.json()

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
  }

  const trimmedName = name.trim()

  try {
    const [oldAccount] = await sql`SELECT name FROM accounts WHERE id = ${Number(id)}`
    if (!oldAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const oldName = oldAccount.name

    await sql`UPDATE expenses SET expense_account = ${trimmedName} WHERE expense_account = ${oldName}`

    const [updated] = await sql`
      UPDATE accounts SET name = ${trimmedName}, updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING id, name
    `
    return NextResponse.json(updated)
  } catch (e) {
    console.error('Failed to rename account:', e)
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Account name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: `Failed to rename account: ${message}` }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const [account] = await sql`SELECT name FROM accounts WHERE id = ${Number(id)}`
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const expenseCount = await sql`SELECT COUNT(*) as count FROM expenses WHERE expense_account = ${account.name}`
    if (expenseCount[0].count > 0) {
      return NextResponse.json({ error: `Cannot delete account with ${expenseCount[0].count} expense(s). Rename it instead.` }, { status: 400 })
    }

    await sql`DELETE FROM accounts WHERE id = ${Number(id)}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Failed to delete account:', e)
    return NextResponse.json({ error: `Failed to delete account: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
