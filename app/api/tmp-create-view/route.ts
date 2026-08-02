import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  await sql`
    CREATE OR REPLACE VIEW active_items AS
    SELECT * FROM items WHERE status IS NULL OR LOWER(status) != 'inactive'
  `
  const check = await sql`SELECT COUNT(*)::int AS n FROM active_items`
  const rawCheck = await sql`SELECT COUNT(*)::int AS n FROM items WHERE status IS NULL OR LOWER(status) != 'inactive'`
  return NextResponse.json({ ok: true, active_items_count: check[0].n, raw_filtered_count: rawCheck[0].n })
}
