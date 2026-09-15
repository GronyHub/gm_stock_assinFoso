import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isConfidentialExpense } from '@/lib/roles'
import { hasFeature, getUserPermissionsMap } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_item_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_group TEXT`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_related_expense BOOLEAN DEFAULT false`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_to_property_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_expense_reasons TEXT`.catch(() => {})
})


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
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const { expense_date, expense_account, description, cf_justify, vendor_name, amount, cf_expense_type, is_property, propertyType, relatedItemId, expense_group, availability, working, location, notWorkingReason, notAvailableReason, is_related_expense, related_to_property_id, related_expense_reasons } = await req.json()

  if (!hasFeature(session.user as any, 'confidential_expenses', await getUserPermissionsMap())) {
    const [existing] = await sql`SELECT expense_account FROM expenses WHERE id = ${Number(id)}`
    if (existing && (isConfidentialExpense(existing.expense_account) || isConfidentialExpense(expense_account))) {
      return badRequest('You do not have access to edit a Salaries expense')
    }
  }

  try {
    // description/cf_justify are set conditionally, not unconditionally like
    // the other fields -- the Expenses tab's edit form only ever sends
    // description now, and the older standalone /expenses page only ever
    // sends cf_justify, so whichever one a given caller omits must be left
    // alone rather than nulled out.
    // Ensure related_item_id, expense_group, and related expense columns exist
    await ensureSchema()

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
        is_property     = COALESCE(${is_property ?? null}, is_property),
        related_item_id = ${relatedItemId ?? null},
        expense_group   = ${expense_group ?? null},
        is_related_expense = ${is_related_expense ?? null},
        related_to_property_id = ${related_to_property_id ?? null},
        related_expense_reasons = ${related_expense_reasons ?? null}
      WHERE id = ${Number(id)}
      RETURNING id, expense_date::date AS expense_date, expense_account, description, cf_justify,
                vendor_name, amount, cf_expense_type, is_property, related_item_id, expense_group,
                is_related_expense, related_to_property_id, related_expense_reasons
    `
    if (!row) return notFound()

    // Ensure a properties row exists if is_property toggled on -- an
    // external-purchase property always links back to this expense (see
    // the properties table's CHECK constraint), never lives in
    // expense_properties (retired in favor of the standalone properties
    // table so a GMC stock draw can create a property without an expense).
    if (row.is_property) {
      try {
        await sql`
          INSERT INTO properties (item_id, name, acquired_date, acquired_via, expense_id, amount, property_status, property_type, availability, working, location, not_working_reason, not_available_reason)
          VALUES (${relatedItemId ?? null}, ${row.expense_account}, ${row.expense_date}, 'external_expense', ${row.id}, ${row.amount}, 'at_shop', ${propertyType ?? null}, ${availability ?? null}, ${working ?? null}, ${location ?? null}, ${notWorkingReason ?? null}, ${notAvailableReason ?? null})
          ON CONFLICT (expense_id) DO UPDATE SET
            item_id = COALESCE(EXCLUDED.item_id, properties.item_id),
            name = EXCLUDED.name,
            amount = EXCLUDED.amount,
            property_type = COALESCE(EXCLUDED.property_type, properties.property_type),
            availability = COALESCE(EXCLUDED.availability, properties.availability),
            working = COALESCE(EXCLUDED.working, properties.working),
            location = COALESCE(EXCLUDED.location, properties.location),
            not_working_reason = COALESCE(EXCLUDED.not_working_reason, properties.not_working_reason),
            not_available_reason = COALESCE(EXCLUDED.not_available_reason, properties.not_available_reason),
            updated_at = NOW()
        `
      } catch (e) {
        return handleError('PUT /api/expenses/[id] property update', e)
      }
    }

    const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
    // 10 minutes flat, same as 'added expense' -- see
    // app/api/expenses/route.ts's own comment on the "typing" duration
    // convention.
    await logActivity(actor, 'edited expense', describeExpense(row.expense_account, row.amount, row.expense_date), 600)

    const [p] = await sql`SELECT property_status, property_type, availability, working, location, not_working_reason, not_available_reason FROM properties WHERE expense_id = ${row.id}`
    return success({ ...row, property_status: p?.property_status ?? null, property_type: p?.property_type ?? null, availability: p?.availability ?? null, working: p?.working ?? null, location: p?.location ?? null, not_working_reason: p?.not_working_reason ?? null, not_available_reason: p?.not_available_reason ?? null, is_related_expense: row.is_related_expense ?? false, related_to_property_id: row.related_to_property_id ?? null, related_expense_reasons: row.related_expense_reasons ?? null })
  } catch (e) {
    return handleError('PUT /api/expenses/[id]', e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  if (!hasFeature(session.user as any, 'confidential_expenses', await getUserPermissionsMap())) {
    const [existing] = await sql`SELECT expense_account FROM expenses WHERE id = ${Number(id)}`
    if (existing && isConfidentialExpense(existing.expense_account)) {
      return badRequest('You do not have access to delete a Salaries expense')
    }
  }

  await sql`DELETE FROM properties WHERE expense_id = ${Number(id)}`
  const [row] = await sql`
    DELETE FROM expenses WHERE id = ${Number(id)}
    RETURNING id, expense_account, amount, expense_date::date AS expense_date
  `
  if (!row) return notFound()

  const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
  await logActivity(actor, 'deleted expense', describeExpense(row.expense_account, row.amount, row.expense_date))

  return success({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error

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
      return badRequest('Invalid status')
    }
    await sql`UPDATE properties SET property_status = ${body.property_status}, updated_at = NOW() WHERE expense_id = ${Number(id)}`

    const [expense] = await sql`SELECT expense_account, amount, expense_date::date AS expense_date FROM expenses WHERE id = ${Number(id)}`
    if (expense) {
      const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
      await logActivity(actor, 'edited expense',
        `${describeExpense(expense.expense_account, expense.amount, expense.expense_date)} — property status → ${body.property_status}`, 600)
    }

    return success({ ok: true, property_status: body.property_status })
  }

  const { availability, working, location, notWorkingReason, notAvailableReason } = body
  if (!availability || !AVAILABILITY_VALUES.includes(availability)) {
    return badRequest('Invalid availability')
  }
  if (working != null && !WORKING_VALUES.includes(working)) {
    return badRequest('Invalid working status')
  }

  await sql`
    UPDATE properties SET
      availability = ${availability}, working = ${working ?? null}, location = ${location ?? null},
      not_working_reason = ${notWorkingReason ?? null}, not_available_reason = ${notAvailableReason ?? null}, updated_at = NOW()
    WHERE expense_id = ${Number(id)}
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
      `${describeExpense(expense.expense_account, expense.amount, expense.expense_date)} — ${parts.join(', ')}`, 600)
  }

  return success({
    ok: true, availability, working: working ?? null, location: location ?? null,
    not_working_reason: notWorkingReason ?? null, not_available_reason: notAvailableReason ?? null,
  })
}
