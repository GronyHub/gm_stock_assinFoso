import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel, isConfidentialExpense } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { ensureExpensePropertyColumns } from '@/lib/expenseProperties'
import { NextRequest, NextResponse } from 'next/server'

function redact(rows: any[], canSeeAmounts: boolean) {
  if (canSeeAmounts) return rows
  return rows.map(r => isConfidentialExpense(r.expense_account) ? { ...r, amount: null, amount_hidden: true } : r)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const canSeeAmounts = isOwnerLevel(session.user as any)

  await ensureExpensePropertyColumns()

  try {
    const rows = await sql`
      SELECT
        e.id, e.expense_date::date AS expense_date, e.expense_account,
        e.description, e.cf_justify, e.vendor_name, e.amount, e.cf_expense_type,
        e.is_property, COALESCE(ep.property_status, 'at_shop') AS property_status,
        ep.availability, ep.working, ep.location, ep.not_working_reason, ep.not_available_reason,
        e.entered_by, e.source, e.source_sheet
      FROM expenses e
      LEFT JOIN expense_properties ep ON ep.expense_id = e.id
      ORDER BY e.expense_date DESC, e.id DESC
    `
    return NextResponse.json(redact(rows, canSeeAmounts))
  } catch {
    const rows = await sql`
      SELECT
        e.id, e.expense_date::date AS expense_date, e.expense_account,
        e.description, e.cf_justify, e.vendor_name, e.amount, e.cf_expense_type,
        e.is_property, COALESCE(ep.property_status, 'at_shop') AS property_status,
        ep.availability, ep.working, ep.location, ep.not_working_reason, ep.not_available_reason,
        NULL AS entered_by, e.source, e.source_sheet
      FROM expenses e
      LEFT JOIN expense_properties ep ON ep.expense_id = e.id
      ORDER BY e.expense_date DESC, e.id DESC
    `
    return NextResponse.json(redact(rows, canSeeAmounts))
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { expense_date, expense_account, description, cf_justify, vendor_name, amount, cf_expense_type, is_property } = await req.json()
  if (!expense_date || !expense_account || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (isConfidentialExpense(expense_account) && !isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can record a Salaries expense' }, { status: 403 })
  }

  const entry = await sql`
    SELECT COALESCE(MAX(entry_number::int), 0) + 1 AS next FROM expenses WHERE entry_number ~ '^[0-9]+$'
  `
  const entryNumber = String(entry[0].next)
  const zohoExpenseId = `APP-${Date.now()}-${entryNumber}`
  const isProp = is_property ?? false

  const enteredBy = session.user?.name || (session.user as any)?.username || null

  try {
    let row
    try {
      [row] = await sql`
        INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, cf_justify, vendor_name, amount, total,
                              cf_expense_type, is_property, source, entry_number, entered_by)
        VALUES (${zohoExpenseId}, ${expense_date}, ${expense_account}, ${description ?? null}, ${cf_justify ?? null}, ${vendor_name ?? null},
                ${amount}, ${amount}, ${cf_expense_type ?? null}, ${isProp}, 'app', ${entryNumber}, ${enteredBy})
        RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
                  vendor_name, amount, cf_expense_type, is_property, entered_by
      `
    } catch (e) {
      console.error('expenses insert with entered_by failed, retrying without it:', e)
      ;[row] = await sql`
        INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, cf_justify, vendor_name, amount, total,
                              cf_expense_type, is_property, source, entry_number)
        VALUES (${zohoExpenseId}, ${expense_date}, ${expense_account}, ${description ?? null}, ${cf_justify ?? null}, ${vendor_name ?? null},
                ${amount}, ${amount}, ${cf_expense_type ?? null}, ${isProp}, 'app', ${entryNumber})
        RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
                  vendor_name, amount, cf_expense_type, is_property
      `
    }

    if (isProp) {
      await sql`
        INSERT INTO expense_properties (expense_id, property_status)
        VALUES (${row.id}, 'at_shop') ON CONFLICT (expense_id) DO NOTHING
      `
    }

    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${expense_date}`
      if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${expense_date})`
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    const confidential = isConfidentialExpense(expense_account)
    await logActivity(enteredBy ?? 'Unknown', 'added expense',
      confidential ? `${expense_account} on ${expense_date}` : `${expense_account} · ₵${Number(amount).toFixed(2)} on ${expense_date}`)
    return NextResponse.json({ ...row, property_status: isProp ? 'at_shop' : null })
  } catch (e) {
    console.error('expenses POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save expense: ${detail}` }, { status: 500 })
  }
}
