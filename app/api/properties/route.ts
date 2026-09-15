import { requireAuth, getActorName, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'

// Properties are their own table now (see migration in
// .claude/PROPERTIES_TABLE_MIGRATION.md) -- a property acquired externally
// (real cash out) links to the expense that paid for it; a property drawn
// from existing GMC stock links to the sale that consumed the stock and
// never touches expenses at all, since no new cash was spent. That split is
// what stops a GMC stock draw from being double-counted as both a sale and
// a fresh expense.
export async function GET(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  // Back-compat: ExpensesTab's "related property" dropdown only wants
  // {id, name} for every property, not the full record.
  if (searchParams.get('minimal') === '1') {
    try {
      const rows = await sql`SELECT id, name FROM properties ORDER BY name ASC`
      return success(rows)
    } catch (e) {
      return handleError('GET /api/properties minimal', e)
    }
  }

  try {
    const rows = await sql`
      SELECT p.id, p.item_id, p.name, p.acquired_date, p.acquired_via, p.expense_id, p.amount,
             COALESCE(p.vendor_name, e.vendor_name) AS vendor_name,
             p.property_status, p.property_type, p.availability, p.working, p.location,
             p.not_working_reason, p.not_available_reason, p.source, p.entered_by
      FROM properties p
      LEFT JOIN expenses e ON e.id = p.expense_id
      ORDER BY p.acquired_date DESC NULLS LAST, p.id DESC
    `
    return success(rows)
  } catch (e) {
    return handleError('GET /api/properties', e)
  }
}

// Creates a property directly from a GMC stock draw -- no expenses row,
// since the cash was already spent when the item was originally purchased
// as sellable stock. Called from the Live Sale "Mark as property" prompt
// right after a GMC tap succeeds (see item/page.tsx's gmcPropertyPrompt).
export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { itemId, sourceLiveSaleTapId, name, amount } = await req.json()
  if (!itemId || !sourceLiveSaleTapId) return badRequest('itemId and sourceLiveSaleTapId are required')

  try {
    const [existing] = await sql`SELECT id FROM properties WHERE source_live_sale_tap_id = ${sourceLiveSaleTapId}`
    if (existing) return success(existing)

    const [tap] = await sql`SELECT tapped_at FROM live_sale_taps WHERE id = ${sourceLiveSaleTapId}`
    if (!tap) return badRequest('Live sale tap not found')

    const [row] = await sql`
      INSERT INTO properties (item_id, name, acquired_date, acquired_via, source_live_sale_tap_id, amount, property_status, source, entered_by)
      VALUES (${itemId}, ${name}, ${tap.tapped_at}::date, 'gmc_stock', ${sourceLiveSaleTapId}, ${amount ?? null}, 'at_shop', 'app', ${session.user?.name ?? null})
      RETURNING id, item_id, name, acquired_date, amount
    `
    await logActivity(getActorName(session), 'marked GMC tap as property', `${name} (from stock, ₵${amount ?? '—'})`, 600)
    return success(row)
  } catch (e) {
    return handleError('POST /api/properties', e)
  }
}
