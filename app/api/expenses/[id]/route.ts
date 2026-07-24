import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel, isConfidentialExpense } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

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
  const [row] = await sql`DELETE FROM expenses WHERE id = ${Number(id)} RETURNING id`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { property_status } = await req.json()

  if (!['at_shop', 'not_at_shop', 'spoilt'].includes(property_status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  await sql`
    INSERT INTO expense_properties (expense_id, property_status, updated_at)
    VALUES (${Number(id)}, ${property_status}, NOW())
    ON CONFLICT (expense_id) DO UPDATE SET property_status = ${property_status}, updated_at = NOW()
  `
  return NextResponse.json({ ok: true, property_status })
}
