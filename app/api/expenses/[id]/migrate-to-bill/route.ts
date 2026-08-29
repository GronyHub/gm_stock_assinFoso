import { requireAuth, badRequest, notFound, success, getActorName, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureBillExpensesTable } from '@/lib/billExpenses'
import { NextRequest } from 'next/server'

// A one-time move, not a link: the chosen expense becomes a bill_expenses
// row against `billId` (with a migrated_from_expense_id breadcrumb for
// traceability) and is then deleted from `expenses` entirely -- nothing is
// left behind there. New extra costs going forward are meant to be entered
// directly on the bill instead (see /api/bills/expenses), so this route only
// exists to catch up historical expenses that were really bill overhead.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const expenseId = await getIdParam(params)
  const { billId } = await req.json() as { billId: number }
  if (!billId) return badRequest('A bill must be chosen.')

  await ensureBillExpensesTable()

  const [expense] = await sql`SELECT id, description, expense_account, amount FROM expenses WHERE id = ${expenseId}`
  if (!expense) return notFound()

  const [bill] = await sql`SELECT id, bill_number FROM bills WHERE id = ${billId}`
  if (!bill) return badRequest('That bill no longer exists.')

  try {
    const description = expense.description || expense.expense_account || null
    const [row] = await sql`
      INSERT INTO bill_expenses (bill_id, description, amount, migrated_from_expense_id)
      VALUES (${billId}, ${description}, ${expense.amount}, ${expense.id})
      RETURNING id, bill_id, description, amount, migrated_from_expense_id, created_at
    `
    await sql`DELETE FROM expenses WHERE id = ${expenseId}`

    const actor = getActorName(session)
    await logActivity(actor, 'migrated expense to bill', `${description ?? 'Expense'} · ₵${Number(expense.amount).toFixed(2)} → Bill ${bill.bill_number}`)
    return success(row)
  } catch (e) {
    return handleError('expenses/[id]/migrate-to-bill POST', e)
  }
}
