import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isConfidentialExpense } from '@/lib/roles'
import { hasFeature, getUserPermissionsMap } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'
import { ensureExpensePropertyColumns } from '@/lib/expenseProperties'
import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_group TEXT`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_related_expense BOOLEAN DEFAULT false`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_to_property_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_expense_reasons TEXT`.catch(() => {})
})


function redact(rows: any[], canSeeAmounts: boolean) {
  if (canSeeAmounts) return rows
  return rows.map(r => isConfidentialExpense(r.expense_account) ? { ...r, amount: null, amount_hidden: true } : r)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const canSeeAmounts = hasFeature(session.user as any, 'confidential_expenses', await getUserPermissionsMap())

  const url = new URL(req.url)
  // Every caller (ExpensesTab, PropertiesPage, expenses/page.tsx) fetches
  // this with no limit/offset -- they want the full expense history, so a
  // low default silently hid everything older than the cap. Only an
  // explicit ?limit caps the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const since = url.searchParams.get('since')

  await initializeDatabase()
  await ensureExpensePropertyColumns()

  try {
    await ensureSchema()
    const rows = await sql`
      SELECT
        e.id, e.expense_date::date AS expense_date, e.expense_account,
        e.description, e.cf_justify, e.vendor_name, e.amount, e.cf_expense_type,
        e.is_property, COALESCE(ep.property_status, 'at_shop') AS property_status,
        ep.property_type, ep.availability, ep.working, ep.location, ep.not_working_reason, ep.not_available_reason,
        e.expense_group, e.entered_by, e.source, e.source_sheet,
        e.is_related_expense, e.related_to_property_id, e.related_expense_reasons,
        e.updated_at
      FROM expenses e
      LEFT JOIN expense_properties ep ON ep.expense_id = e.id
      ${since ? sql`WHERE e.updated_at > ${since}::timestamp` : sql``}
      ORDER BY e.expense_date DESC, e.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
    if (rows.length === limit) {
      console.warn(`expenses: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    return NextResponse.json(redact(rows, canSeeAmounts))
  } catch {
    await ensureSchema()
    const rows = await sql`
      SELECT
        e.id, e.expense_date::date AS expense_date, e.expense_account,
        e.description, e.cf_justify, e.vendor_name, e.amount, e.cf_expense_type,
        e.is_property, COALESCE(ep.property_status, 'at_shop') AS property_status,
        ep.property_type, ep.availability, ep.working, ep.location, ep.not_working_reason, ep.not_available_reason,
        e.expense_group, NULL AS entered_by, e.source, e.source_sheet,
        e.is_related_expense, e.related_to_property_id, e.related_expense_reasons,
        e.updated_at
      FROM expenses e
      LEFT JOIN expense_properties ep ON ep.expense_id = e.id
      ${since ? sql`WHERE e.updated_at > ${since}::timestamp` : sql``}
      ORDER BY e.expense_date DESC, e.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
    return NextResponse.json(redact(rows, canSeeAmounts))
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { expense_date, expense_account, description, cf_justify, vendor_name, amount, cf_expense_type, is_property, expense_group, is_related_expense, related_to_property_id, related_expense_reasons } = await req.json()
  if (!expense_date || !expense_account || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (isConfidentialExpense(expense_account) && !hasFeature(session.user as any, 'confidential_expenses', await getUserPermissionsMap())) {
    return NextResponse.json({ error: 'You do not have access to record a Salaries expense' }, { status: 403 })
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
                              cf_expense_type, is_property, expense_group, source, entry_number, entered_by,
                              is_related_expense, related_to_property_id, related_expense_reasons)
        VALUES (${zohoExpenseId}, ${expense_date}, ${expense_account}, ${description ?? null}, ${cf_justify ?? null}, ${vendor_name ?? null},
                ${amount}, ${amount}, ${cf_expense_type ?? null}, ${isProp}, ${expense_group ?? null}, 'app', ${entryNumber}, ${enteredBy},
                ${is_related_expense ?? false}, ${related_to_property_id ?? null}, ${related_expense_reasons ?? null})
        RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
                  vendor_name, amount, cf_expense_type, is_property, expense_group, entered_by,
                  is_related_expense, related_to_property_id, related_expense_reasons
      `
    } catch (e) {
      console.error('expenses insert with entered_by failed, retrying without it:', e)
      ;[row] = await sql`
        INSERT INTO expenses (zoho_expense_id, expense_date, expense_account, description, cf_justify, vendor_name, amount, total,
                              cf_expense_type, is_property, expense_group, source, entry_number,
                              is_related_expense, related_to_property_id, related_expense_reasons)
        VALUES (${zohoExpenseId}, ${expense_date}, ${expense_account}, ${description ?? null}, ${cf_justify ?? null}, ${vendor_name ?? null},
                ${amount}, ${amount}, ${cf_expense_type ?? null}, ${isProp}, ${expense_group ?? null}, 'app', ${entryNumber},
                ${is_related_expense ?? false}, ${related_to_property_id ?? null}, ${related_expense_reasons ?? null})
        RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
                  vendor_name, amount, cf_expense_type, is_property, expense_group,
                  is_related_expense, related_to_property_id, related_expense_reasons
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
