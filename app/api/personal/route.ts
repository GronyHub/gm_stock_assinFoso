import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePersonalSubcategoryColumn } from '@/lib/personalLedger'
import { initializeDatabase } from '@/lib/dbInitialize'

function isAllowed(session: any) {
  const role     = (session?.user as any)?.role     as string | undefined
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return role === 'owner' || username === 'joe'
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return success([])

  await initializeDatabase()
  await ensurePersonalSubcategoryColumn()
  const entries = await sql`
    SELECT id, entry_date, description, amount, direction, category, subcategory, notes, needs_review
    FROM grony_personal_ledger
    ORDER BY entry_date DESC, id DESC
  `
  return success(entries)
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return badRequest('Forbidden')

  const { entry_date, description, amount, direction, category, subcategory, notes, needs_review } = await req.json()
  if (!entry_date || !description || !amount || !direction) {
    return badRequest('Missing fields')
  }
  await initializeDatabase()
  await ensurePersonalSubcategoryColumn()
  const [row] = await sql`
    INSERT INTO grony_personal_ledger (entry_date, description, amount, direction, category, subcategory, notes, needs_review, source)
    VALUES (${entry_date}, ${description}, ${amount}, ${direction}, ${category ?? 'Other'}, ${subcategory ?? null}, ${notes ?? null}, ${needs_review ?? false}, 'app')
    RETURNING id
  `
  return success({ id: row.id })
}

export async function PUT(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return badRequest('Forbidden')

  const { id, category, subcategory, notes, description, amount, needs_review } = await req.json()
  if (!id) return badRequest('Missing id')

  await initializeDatabase()
  await ensurePersonalSubcategoryColumn()
  await sql`
    UPDATE grony_personal_ledger
    SET category     = COALESCE(${category ?? null}, category),
        subcategory  = CASE WHEN ${subcategory !== undefined} THEN ${subcategory ?? null} ELSE subcategory END,
        notes        = COALESCE(${notes ?? null}, notes),
        description  = COALESCE(${description ?? null}, description),
        amount       = COALESCE(${amount ?? null}, amount),
        needs_review = COALESCE(${needs_review ?? null}, needs_review)
    WHERE id = ${id}
  `
  return success({ ok: true })
}

export async function DELETE(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return badRequest('Forbidden')

  const { id } = await req.json()
  if (!id) return badRequest('Missing id')

  await sql`DELETE FROM grony_personal_ledger WHERE id = ${id}`
  return success({ ok: true })
}
