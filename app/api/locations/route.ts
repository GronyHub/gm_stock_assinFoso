import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Locations aren't a separate managed entity -- just the distinct values
// already saved on customers AND vendors (pooled, since the same town
// applies to either), offered back as suggestions so a new record's
// location gets picked from what's already in use (or added as a
// genuinely new one) instead of a free-typed near-duplicate variant.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  const rows = await sql`
    SELECT location FROM customers WHERE location IS NOT NULL AND location <> ''
    UNION
    SELECT location FROM vendors WHERE location IS NOT NULL AND location <> ''
    ORDER BY location
  `
  return NextResponse.json(rows.map((r: any) => r.location))
}
