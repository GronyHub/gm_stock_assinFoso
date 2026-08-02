import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    out.merge_activity = await sql`
      SELECT id, staff_name, action, details, created_at
      FROM activity_logs
      WHERE action = 'merged items' AND details ILIKE '%A4 SHEETS DOUBLE A%'
      ORDER BY created_at
    `
  } catch (e) { out.merge_activity_error = String(e) }

  try {
    out.item_columns = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'items'
    `
  } catch (e) { out.item_columns_error = String(e) }

  try {
    out.item_382_full = await sql`SELECT * FROM items WHERE id = 382`
  } catch (e) { out.item_382_error = String(e) }

  try {
    out.item_4_aliases = await sql`SELECT * FROM item_aliases WHERE item_id = 4 ORDER BY id`
  } catch (e) { out.item_4_aliases_error = String(e) }

  try {
    out.dismissed_dup_382 = await sql`
      SELECT * FROM dismissed_duplicates WHERE item_id1 IN (4,382) OR item_id2 IN (4,382)
    `
  } catch (e) { out.dismissed_dup_error = String(e) }

  return NextResponse.json(out)
}
