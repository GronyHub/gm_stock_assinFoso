import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const groups = await sql`
    SELECT cf_group, COUNT(*)::int AS cnt
    FROM active_items
    WHERE LOWER(COALESCE(product_type, 'goods')) = 'service'
    GROUP BY cf_group
    ORDER BY cf_group NULLS LAST
  `
  const sample = await sql`
    SELECT id, canonical_name, cf_group, product_type, status
    FROM active_items
    WHERE LOWER(COALESCE(product_type, 'goods')) = 'service'
    ORDER BY cf_group NULLS LAST, canonical_name
    LIMIT 60
  `
  return NextResponse.json({ groupCount: groups.length, groups, sample })
}
