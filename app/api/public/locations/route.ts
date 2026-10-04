import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { once } from '@/lib/once'
import { getSortedGhanaTowns } from '@/lib/ghanaLocations'

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

// PUBLIC endpoint - no auth required - returns available locations
export async function GET() {
  try {
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
    await sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
    await ensureLocationsTable()

    // Start with Ghana towns (Assin prioritized, then Central Region, then others)
    const ghanaLocationsSet = new Set(getSortedGhanaTowns())

    // Add custom locations from database (not already in Ghana towns list)
    const customersVendorsRows = await sql`
      SELECT location FROM customers WHERE location IS NOT NULL AND location <> ''
      UNION
      SELECT location FROM vendors WHERE location IS NOT NULL AND location <> ''
    `
    const managedRows = await sql`SELECT location FROM managed_locations ORDER BY location`

    customersVendorsRows.forEach((r: any) => {
      if (r.location) ghanaLocationsSet.add(r.location)
    })
    managedRows.forEach((r: any) => {
      if (r.location) ghanaLocationsSet.add(r.location)
    })

    return NextResponse.json(Array.from(ghanaLocationsSet))
  } catch (e) {
    console.error('get locations', e)
    return NextResponse.json([], { status: 500 })
  }
}

// PUBLIC endpoint - no auth required - add new location during registration
export async function POST(req: Request) {
  try {
    const { location } = await req.json().catch(() => ({}))

    if (!location || typeof location !== 'string') {
      return NextResponse.json({ error: 'Location is required.' }, { status: 400 })
    }

    const name = location.trim()
    if (!name) {
      return NextResponse.json({ error: 'Location cannot be empty.' }, { status: 400 })
    }

    await ensureLocationsTable()

    // Check if already exists
    const existing = await sql`SELECT 1 FROM managed_locations WHERE location = ${name}`
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, location: name })
    }

    // Add new location
    await sql`INSERT INTO managed_locations (location) VALUES (${name})`
    return NextResponse.json({ ok: true, location: name })
  } catch (e) {
    console.error('add public location', e)
    return NextResponse.json({ error: 'Could not add location.' }, { status: 500 })
  }
}
