import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    const rows = await sql`SELECT COUNT(*)::int AS n FROM active_items i LEFT JOIN item_stock_summary s ON s.item_id = i.id`
    out.items_route = rows[0].n
  } catch (e) { out.items_route_error = String(e) }

  try {
    const rows = await sql`
      SELECT i.id, i.canonical_name AS name FROM active_items i
      WHERE i.canonical_name ILIKE ${'%A4 SHEETS DOUBLE%'}
    `
    out.items_search_a4 = rows
  } catch (e) { out.items_search_error = String(e) }

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM active_items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE LOWER(COALESCE(i.status, '')) != 'service'
    `
    out.items_all_count = rows[0].n
  } catch (e) { out.items_all_error = String(e) }

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM active_items i LEFT JOIN item_aliases a ON a.item_id = i.id
    `
    out.aliases_wide_count = rows[0].n
  } catch (e) { out.aliases_wide_error = String(e) }

  try {
    const rows = await sql`SELECT id, canonical_name AS name FROM active_items WHERE canonical_name ILIKE ${'%A4 SHEETS%'}`
    out.search_a4 = rows
  } catch (e) { out.search_error = String(e) }

  try {
    const rows = await sql`SELECT COUNT(*)::int AS n FROM active_items i LEFT JOIN item_audio_advert_status s ON s.item_id = i.id`
    out.advert_status_count = rows[0].n
  } catch (e) { out.advert_status_error = String(e) }

  try {
    const rows = await sql`SELECT COUNT(*)::int AS n FROM active_items`
    out.good_service_matches_count = rows[0].n
  } catch (e) { out.good_service_matches_error = String(e) }

  return NextResponse.json(out)
}
