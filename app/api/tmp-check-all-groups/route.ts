import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const groups = await sql`
    SELECT cf_group, COALESCE(product_type, 'goods') AS product_type, COUNT(*)::int AS cnt
    FROM active_items
    GROUP BY cf_group, COALESCE(product_type, 'goods')
    ORDER BY cf_group NULLS LAST, product_type
  `
  return NextResponse.json({ count: groups.length, groups })
}
