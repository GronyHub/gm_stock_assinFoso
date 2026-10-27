import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

// The list of accounts a bill's extra costs can be filed under (Delivery, Mobile Money Charges, ...).
const DEFAULTS = ['Delivery', 'Transport', 'Mobile Money Charges', 'Bank Charges', 'Loading & Offloading', 'Packaging', 'Customs & Duty', 'Insurance', 'Other']
const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS bill_expense_accounts (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bill_expense_accounts_name ON bill_expense_accounts (LOWER(name))`.catch(() => {})
  for (const n of DEFAULTS) await sql`INSERT INTO bill_expense_accounts (name, created_by) VALUES (${n}, 'system') ON CONFLICT DO NOTHING`.catch(() => {})
})

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensure()
    const rows = await sql`SELECT id, name FROM bill_expense_accounts ORDER BY (name = 'Other'), name`
    return success(rows)
  } catch (e) { return handleError('bill expense accounts GET', e) }
}

// POST { name } -- add a new account to the list
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensure()
    const b = await req.json().catch(() => ({}))
    const name = String(b.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (name.length < 2) return badRequest('Type the name of the account.')
    await sql`INSERT INTO bill_expense_accounts (name, created_by) VALUES (${name}, ${getActorName(session)}) ON CONFLICT DO NOTHING`
    const [row] = await sql`SELECT id, name FROM bill_expense_accounts WHERE LOWER(name) = LOWER(${name})`
    return success(row, 201)
  } catch (e) { return handleError('bill expense accounts POST', e) }
}
