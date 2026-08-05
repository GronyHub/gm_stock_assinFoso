import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureExpenseOrders } from '@/lib/expenseOrders'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    await ensureExpenseOrders()
    const rows = await sql`
      SELECT id, expense_name, vendor_name, price, notes, entered_by, created_at
      FROM expense_orders
      ORDER BY created_at DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('expense-orders GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { expense_name, vendor_name, price, notes } = await req.json()
  if (!expense_name || !String(expense_name).trim()) {
    return NextResponse.json({ error: 'Expense name is required' }, { status: 400 })
  }

  const enteredBy = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    await ensureExpenseOrders()
    const [row] = await sql`
      INSERT INTO expense_orders (expense_name, vendor_name, price, notes, entered_by)
      VALUES (${String(expense_name).trim()}, ${vendor_name?.trim() || null}, ${price === '' || price == null ? null : price}, ${notes || null}, ${enteredBy})
      RETURNING id, expense_name, vendor_name, price, notes, entered_by, created_at
    `
    await logActivity(enteredBy, 'added expense order', row.expense_name)
    return NextResponse.json(row)
  } catch (e) {
    console.error('expense-orders POST error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
