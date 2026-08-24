import { requireAuth, getActorName, badRequest, success, handleError } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureExpenseOrders } from '@/lib/expenseOrders'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return NextResponse.json([], { status: 401 })

  try {
    await ensureDbInitialized()
    await ensureExpenseOrders()
    const rows = await sql`
      SELECT id, expense_name, vendor_name, price, notes, entered_by, created_at
      FROM expense_orders
      ORDER BY created_at DESC
    `
    return success(rows)
  } catch (e) {
    return handleError('expense-orders GET', e)
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { expense_name, vendor_name, price, notes } = await req.json()
  if (!expense_name || !String(expense_name).trim()) {
    return badRequest('Expense name is required')
  }

  const enteredBy = getActorName(session)

  try {
    await ensureDbInitialized()
    await ensureExpenseOrders()
    const [row] = await sql`
      INSERT INTO expense_orders (expense_name, vendor_name, price, notes, entered_by)
      VALUES (${String(expense_name).trim()}, ${vendor_name?.trim() || null}, ${price === '' || price == null ? null : price}, ${notes || null}, ${enteredBy})
      RETURNING id, expense_name, vendor_name, price, notes, entered_by, created_at
    `
    await logActivity(enteredBy, 'added expense order', row.expense_name)
    return success(row)
  } catch (e) {
    return handleError('expense-orders POST', e)
  }
}
