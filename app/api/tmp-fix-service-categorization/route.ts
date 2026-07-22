import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-off: these items are named like services (were flagged as "No CP"
// only because product_type wasn't set to 'service', so the usual
// exclusion for services never applied) but aren't tagged as such. id 328
// (" A3 Brown Env  single - alias") is deliberately excluded -- it isn't
// named like a service, so its missing cost price is a separate issue.
const SERVICE_IDS = [109, 110, 325, 324, 327, 336, 348]

export async function POST() {
  const rows = await sql`
    UPDATE items SET product_type = 'service'
    WHERE id = ANY(${SERVICE_IDS})
    RETURNING id, canonical_name, product_type
  `
  return NextResponse.json(rows)
}
