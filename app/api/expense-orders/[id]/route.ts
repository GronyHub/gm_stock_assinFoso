import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { expense_name, vendor_name, price, notes } = await req.json()
  if (!expense_name || !String(expense_name).trim()) {
    return NextResponse.json({ error: 'Expense name is required' }, { status: 400 })
  }

  try {
    const [row] = await sql`
      UPDATE expense_orders
      SET expense_name = ${String(expense_name).trim()},
          vendor_name = ${vendor_name?.trim() || null},
          price = ${price === '' || price == null ? null : price},
          notes = ${notes || null}
      WHERE id = ${Number(id)}
      RETURNING id, expense_name, vendor_name, price, notes, entered_by, created_at
    `
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    await logActivity(actor, 'edited expense order', row.expense_name)
    return NextResponse.json(row)
  } catch (e) {
    console.error('expense-orders PUT error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const [row] = await sql`DELETE FROM expense_orders WHERE id = ${Number(id)} RETURNING expense_name`
    if (row) {
      const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
      await logActivity(actor, 'deleted expense order', row.expense_name)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('expense-orders DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
