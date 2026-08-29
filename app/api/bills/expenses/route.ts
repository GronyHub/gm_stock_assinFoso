import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureBillExpensesTable } from '@/lib/billExpenses'
import { NextRequest } from 'next/server'

// All bill_expenses rows -- fetched in full (like /api/bills/all-lines),
// since BillsTab needs every one to compute each group's Shared Expenses.
export async function GET() {
  await ensureBillExpensesTable()
  try {
    const rows = await sql`
      SELECT id, bill_id, description, amount, migrated_from_expense_id, created_at
      FROM bill_expenses
      ORDER BY bill_id, id
    `
    return success(rows)
  } catch (e) {
    return success([])
  }
}

// Adds one extra-cost line (transport, bank charges, ...) against a bill --
// `billId` should be the group's representative bill id (the same one
// BillsTab's own group-edit ✏️ already treats as standing in for the whole
// (date, vendor) group), so it's shared across every item bought together.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { billId, description, amount } = await req.json() as { billId: number; description?: string; amount: number }
  if (!billId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return badRequest('A bill and a positive amount are required.')
  }

  await ensureBillExpensesTable()
  try {
    const [row] = await sql`
      INSERT INTO bill_expenses (bill_id, description, amount)
      VALUES (${billId}, ${description || null}, ${amount})
      RETURNING id, bill_id, description, amount, migrated_from_expense_id, created_at
    `
    const actor = session!.user?.name || (session!.user as any)?.username || 'Unknown'
    await logActivity(actor, 'added bill expense', `Bill #${billId} · ₵${Number(amount).toFixed(2)}${description ? ` — ${description}` : ''}`)
    return success(row)
  } catch (e) {
    return handleError('bills/expenses POST', e)
  }
}
