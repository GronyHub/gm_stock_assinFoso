import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'

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
  await ensureLocationsTable()

  const customersVendorsRows = await sql`
    SELECT location FROM customers WHERE location IS NOT NULL AND location <> ''
    UNION
    SELECT location FROM vendors WHERE location IS NOT NULL AND location <> ''
  `
  const managedRows = await sql`SELECT location FROM managed_locations ORDER BY location`

  const allLocations = new Set<string>()
  customersVendorsRows.forEach((r: any) => {
    if (r.location) allLocations.add(r.location)
  })
  managedRows.forEach((r: any) => {
    if (r.location) allLocations.add(r.location)
  })

  return NextResponse.json(Array.from(allLocations).sort())
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { location } = await req.json()
  if (!location || typeof location !== 'string') {
    return NextResponse.json({ error: 'Location is required.' }, { status: 400 })
  }

  const name = location.trim()
  if (!name) {
    return NextResponse.json({ error: 'Location cannot be empty.' }, { status: 400 })
  }

  try {
    await ensureLocationsTable()

    // Check if already exists
    const existing = await sql`SELECT 1 FROM managed_locations WHERE location = ${name}`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'This location already exists.' }, { status: 400 })
    }

    // Add new location
    await sql`INSERT INTO managed_locations (location) VALUES (${name})`
    return NextResponse.json({ location: name })
  } catch (e) {
    console.error('Error adding location:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not add location: ${detail}` }, { status: 500 })
  }
}

const ensureLocationsTable = once(async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS managed_locations (
        location TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `
  } catch (e) {
    console.error('Error ensuring locations table:', e)
  }
})
