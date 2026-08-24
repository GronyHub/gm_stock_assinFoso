import { requireAuth, getActorName, badRequest, notFound, success, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const expenseId = await getIdParam(params)
  const { expense_name, vendor_name, price, notes } = await req.json()
  if (!expense_name || !String(expense_name).trim()) {
    return badRequest('Expense name is required')
  }

  try {
    const [row] = await sql`
      UPDATE expense_orders
      SET expense_name = ${String(expense_name).trim()},
          vendor_name = ${vendor_name?.trim() || null},
          price = ${price === '' || price == null ? null : price},
          notes = ${notes || null}
      WHERE id = ${expenseId}
      RETURNING id, expense_name, vendor_name, price, notes, entered_by, created_at
    `
    if (!row) return notFound()

    const actor = getActorName(session)
    await logActivity(actor, 'edited expense order', row.expense_name)
    return success(row)
  } catch (e) {
    return handleError('expense-orders PUT', e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const expenseId = await getIdParam(params)
  try {
    const [row] = await sql`DELETE FROM expense_orders WHERE id = ${expenseId} RETURNING expense_name`
    if (row) {
      const actor = getActorName(session)
      await logActivity(actor, 'deleted expense order', row.expense_name)
    }
    return success({ ok: true })
  } catch (e) {
    return handleError('expense-orders DELETE', e)
  }
}
