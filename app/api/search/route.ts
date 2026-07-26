import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Backs the global search (top row, next to Grony Cash/Grony Manage) --
// separate from the per-view search bars already on most tabs, which only
// filter whatever's already on screen. This looks across the handful of
// things someone might actually be hunting for by name/number without
// knowing which section it lives in. Each table is queried independently
// and swallows its own error so one missing/renamed column can't take the
// whole search down.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({})
  const like = `%${q}%`

  const [items, customers, vendors, sales, bills, announcements] = await Promise.all([
    sql`
      SELECT id, canonical_name AS name, cf_group
      FROM items
      WHERE canonical_name ILIKE ${like} AND LOWER(status) != 'inactive'
      ORDER BY canonical_name LIMIT 6
    `.catch(() => []),
    sql`
      SELECT id, display_name, company_name
      FROM customers
      WHERE display_name ILIKE ${like} OR company_name ILIKE ${like}
      ORDER BY display_name LIMIT 6
    `.catch(() => []),
    sql`
      SELECT id, display_name, company_name
      FROM vendors
      WHERE display_name ILIKE ${like} OR company_name ILIKE ${like}
      ORDER BY display_name LIMIT 6
    `.catch(() => []),
    sql`
      SELECT id, receipt_number, customer_name, receipt_date::date AS receipt_date
      FROM sales_receipts
      WHERE receipt_number ILIKE ${like} OR customer_name ILIKE ${like}
      ORDER BY receipt_date DESC LIMIT 6
    `.catch(() => []),
    sql`
      SELECT id, bill_number, vendor_name, bill_date::date AS bill_date
      FROM bills
      WHERE bill_number ILIKE ${like} OR vendor_name ILIKE ${like}
      ORDER BY bill_date DESC LIMIT 6
    `.catch(() => []),
    sql`
      SELECT id, body, author, created_at
      FROM announcements
      WHERE body ILIKE ${like} OR author ILIKE ${like}
      ORDER BY created_at DESC LIMIT 6
    `.catch(() => []),
  ])

  return NextResponse.json({ items, customers, vendors, sales, bills, announcements })
}
