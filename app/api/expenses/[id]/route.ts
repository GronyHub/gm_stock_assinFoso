import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel, isConfidentialExpense } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import { ensureExpensePropertyColumns } from '@/lib/expenseProperties'
import { NextRequest, NextResponse } from 'next/server'

const AVAILABILITY_VALUES = ['available', 'not_available']
const WORKING_VALUES = ['working', 'not_working']

type Ctx = { params: Promise<{ id: string }> }

// Same "<account> · ₵<amount> on <date>" shape "added expense" already logs
// (see /api/expenses POST) -- keeps every expense action readable the same
// way in History, and keeps ExpensesTab's click-to-jump regex working
// against edit/delete entries too, not just adds. Salaries stays amount-free
// either way, matching the confidentiality rule elsewhere.
function describeExpense(account: string, amount: string | number, date: string) {
  const d = String(date).slice(0, 10)
  return isConfidentialExpense(account) ? `${account} on ${d}` : `${account} · ₵${Number(amount).toFixed(2)} on ${d}`
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { expense_date, expense_account, description, cf_justify, vendor_name, amount, cf_expense_type, is_property } = await req.json()

  if (!isOwnerLevel(session.user as any)) {
    const [existing] = await sql`SELECT expense_account FROM expenses WHERE id = ${Number(id)}`
    if (existing && (isConfidentialExpense(existing.expense_account) || isConfidentialExpense(expense_account))) {
      return NextResponse.json({ error: 'Only the owner or Joe can edit a Salaries expense' }, { status: 403 })
    }
  }

  // description/cf_justify are set conditionally, not unconditionally like
  // the other fields -- the Expenses tab's edit form only ever sends
  // description now, and the older standalone /expenses page only ever
  // sends cf_justify, so whichever one a given caller omits must be left
  // alone rather than nulled out.
  const [row] = await sql`
    UPDATE expenses SET
      expense_date    = COALESCE(${expense_date ?? null}::date, expense_date),
      expense_account = COALESCE(${expense_account ?? null}, expense_account),
      description     = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE description END,
      cf_justify      = CASE WHEN ${cf_justify !== undefined} THEN ${cf_justify ?? null} ELSE cf_justify END,
      vendor_name     = ${vendor_name ?? null},
      amount          = COALESCE(${amount ?? null}, amount),
      total           = COALESCE(${amount ?? null}, total),
      cf_expense_type = ${cf_expense_type ?? null},
      is_property     = COALESCE(${is_property ?? null}, is_property)
    WHERE id = ${Number(id)}
    RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
              vendor_name, amount, cf_expense_type, is_property
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Ensure property row exists if is_property toggled on
  if (row.is_property) {
    await sql`
      INSERT INTO expense_properties (expense_id, property_status)
      VALUES (${row.id}, 'at_shop') ON CONFLICT (expense_id) DO NOTHING
    `
  }

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
  await logActivity(actor, 'edited expense', describeExpense(row.expense_account, row.amount, row.expense_date))

  const [ep] = await sql`SELECT property_status FROM expense_properties WHERE expense_id = ${row.id}`
  return NextResponse.json({ ...row, property_status: ep?.property_status ?? null })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!isOwnerLevel(session.user as any)) {
    const [existing] = await sql`SELECT expense_account FROM expenses WHERE id = ${Number(id)}`
    if (existing && isConfidentialExpense(existing.expense_account)) {
      return NextResponse.json({ error: 'Only the owner or Joe can delete a Salaries expense' }, { status: 403 })
    }
  }

  await sql`DELETE FROM expense_properties WHERE expense_id = ${Number(id)}`
  const [row] = await sql`
    DELETE FROM expenses WHERE id = ${Number(id)}
    RETURNING id, expense_account, amount, expense_date::date AS expense_date
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
  await logActivity(actor, 'deleted expense', describeExpense(row.expense_account, row.amount, row.expense_date))

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    property_status?: string
    availability?: 'available' | 'not_available'
    working?: 'working' | 'not_working' | null
    location?: string | null
    notWorkingReason?: string | null
    notAvailableReason?: string | null
  }

  // Two independent shapes land here: the older standalone /expenses page
  // still sends the original { property_status } (at_shop/not_at_shop/
  // spoilt), while the Expenses tab's edit panel sends the newer
  // Available/Not Available -> Working+Location or Reason cascade. Each
  // only ever touches its own columns, so neither can clobber the other.
  if (body.property_status !== undefined) {
    if (!['at_shop', 'not_at_shop', 'spoilt'].includes(body.property_status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    await sql`
      INSERT INTO expense_properties (expense_id, property_status, updated_at)
      VALUES (${Number(id)}, ${body.property_status}, NOW())
      ON CONFLICT (expense_id) DO UPDATE SET property_status = ${body.property_status}, updated_at = NOW()
    `

    const [expense] = await sql`SELECT expense_account, amount, expense_date::date AS expense_date FROM expenses WHERE id = ${Number(id)}`
    if (expense) {
      const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
      await logActivity(actor, 'edited expense',
        `${describeExpense(expense.expense_account, expense.amount, expense.expense_date)} — property status → ${body.property_status}`)
    }

    return NextResponse.json({ ok: true, property_status: body.property_status })
  }

  const { availability, working, location, notWorkingReason, notAvailableReason } = body
  if (!availability || !AVAILABILITY_VALUES.includes(availability)) {
    return NextResponse.json({ error: 'Invalid availability' }, { status: 400 })
  }
  if (working != null && !WORKING_VALUES.includes(working)) {
    return NextResponse.json({ error: 'Invalid working status' }, { status: 400 })
  }

  await ensureExpensePropertyColumns()
  await sql`
    INSERT INTO expense_properties (expense_id, availability, working, location, not_working_reason, not_available_reason, updated_at)
    VALUES (${Number(id)}, ${availability}, ${working ?? null}, ${location ?? null}, ${notWorkingReason ?? null}, ${notAvailableReason ?? null}, NOW())
    ON CONFLICT (expense_id) DO UPDATE SET
      availability = ${availability}, working = ${working ?? null}, location = ${location ?? null},
      not_working_reason = ${notWorkingReason ?? null}, not_available_reason = ${notAvailableReason ?? null}, updated_at = NOW()
  `

  const [expense] = await sql`SELECT expense_account, amount, expense_date::date AS expense_date FROM expenses WHERE id = ${Number(id)}`
  if (expense) {
    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    const parts = [availability === 'available' ? 'Available' : 'Not Available']
    if (availability === 'available') {
      if (working) parts.push(working === 'working' ? 'Working' : 'Not Working')
      if (location) parts.push(location)
      if (working === 'not_working' && notWorkingReason) parts.push(notWorkingReason)
    } else if (notAvailableReason) {
      parts.push(notAvailableReason)
    }
    await logActivity(actor, 'edited expense',
      `${describeExpense(expense.expense_account, expense.amount, expense.expense_date)} — ${parts.join(', ')}`)
  }

  return NextResponse.json({
    ok: true, availability, working: working ?? null, location: location ?? null,
    not_working_reason: notWorkingReason ?? null, not_available_reason: notAvailableReason ?? null,
  })
}
